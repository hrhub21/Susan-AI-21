import fs from 'fs-extra';
import path from 'path';
import { Worker } from 'worker_threads';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

export class PluginService extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.sandboxes = new Map();
    this.executions = new Map();
    this.pluginRegistry = new Map();
    this.securityPolicies = new Map();
    this.pluginDirectory = path.join(process.cwd(), 'plugins');
    this.sandboxDirectory = path.join(process.cwd(), 'sandboxes');
    
    this.initializePluginSystem();
  }

  async initializePluginSystem() {
    // Ensure directories exist
    await fs.ensureDir(this.pluginDirectory);
    await fs.ensureDir(this.sandboxDirectory);

    // Load existing plugins
    await this.loadExistingPlugins();

    // Set up security policies
    this.setupSecurityPolicies();

    logger.info('Plugin system initialized', {
      pluginsLoaded: this.plugins.size,
      sandboxDirectory: this.sandboxDirectory
    });
  }

  /**
   * Install a new plugin with security validation
   */
  async installPlugin(source, options = {}) {
    const {
      userId,
      name,
      version,
      permissions = [],
      securityLevel = 'sandboxed',
      autoApprove = false,
      configuration = {},
      installSource = 'manual'
    } = options;

    const pluginId = this.generatePluginId();
    const installationDir = path.join(this.pluginDirectory, pluginId);

    try {
      // Create installation directory
      await fs.ensureDir(installationDir);

      // Download/extract plugin based on source type
      const pluginFiles = await this.downloadPlugin(source, installationDir);

      // Validate plugin structure and manifest
      const manifest = await this.validatePluginManifest(installationDir);

      // Security assessment
      const securityAssessment = await this.assessPluginSecurity(pluginFiles, manifest);

      // Create plugin record
      const plugin = {
        id: pluginId,
        name: name || manifest.name,
        version: version || manifest.version,
        description: manifest.description,
        author: manifest.author,
        status: autoApprove ? 'active' : 'pending_approval',
        securityLevel,
        securityAssessment,
        permissions: this.normalizePermissions(permissions.concat(manifest.permissions || [])),
        configuration: { ...manifest.defaultConfig, ...configuration },
        installSource,
        installPath: installationDir,
        manifest,
        installedBy: userId,
        installedAt: new Date(),
        lastUpdated: new Date(),
        dependencies: manifest.dependencies || [],
        metadata: {
          fileCount: pluginFiles.length,
          totalSize: await this.calculateDirectorySize(installationDir),
          checksum: await this.calculatePluginChecksum(installationDir)
        }
      };

      // Store plugin
      this.plugins.set(pluginId, plugin);
      await this.savePluginRegistry();

      // Set up sandbox if required
      if (securityLevel === 'sandboxed' || securityLevel === 'isolated') {
        await this.createPluginSandbox(pluginId, plugin);
      }

      // Auto-approve if conditions are met
      if (autoApprove && this.canAutoApprove(plugin)) {
        await this.approvePlugin(pluginId);
      }

      logger.info('Plugin installed', {
        pluginId,
        name: plugin.name,
        version: plugin.version,
        securityLevel,
        status: plugin.status,
        userId
      });

      this.emit('plugin:installed', { pluginId, plugin, userId });

      return {
        pluginId,
        status: plugin.status,
        securityAssessment: securityAssessment.summary,
        permissions: plugin.permissions,
        requiresApproval: !autoApprove
      };

    } catch (error) {
      // Clean up on failure
      await fs.remove(installationDir).catch(() => {});

      logger.error('Plugin installation failed', {
        pluginId,
        source,
        error: error.message,
        userId
      });

      throw ApiError.badRequest(`Plugin installation failed: ${error.message}`);
    }
  }

  /**
   * Execute plugin function with security controls
   */
  async executePlugin(pluginId, functionName, parameters = {}, options = {}) {
    const {
      userId,
      timeout = 30000,
      maxMemory = 100 * 1024 * 1024, // 100MB
      allowNetworkAccess = false,
      allowFileSystemAccess = false,
      context = {}
    } = options;

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw ApiError.notFound(`Plugin ${pluginId} not found`);
    }

    if (plugin.status !== 'active') {
      throw ApiError.badRequest(`Plugin ${pluginId} is not active (status: ${plugin.status})`);
    }

    // Validate permissions
    this.validatePluginExecution(plugin, functionName, parameters, options);

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    const execution = {
      id: executionId,
      pluginId,
      functionName,
      parameters,
      userId,
      status: 'running',
      startTime,
      timeout,
      maxMemory,
      context
    };

    this.executions.set(executionId, execution);

    try {
      let result;

      switch (plugin.securityLevel) {
        case 'trusted':
          result = await this.executeTrustedPlugin(plugin, functionName, parameters, execution);
          break;
        case 'sandboxed':
          result = await this.executeSandboxedPlugin(plugin, functionName, parameters, execution);
          break;
        case 'isolated':
          result = await this.executeIsolatedPlugin(plugin, functionName, parameters, execution);
          break;
        case 'restricted':
          result = await this.executeRestrictedPlugin(plugin, functionName, parameters, execution);
          break;
        default:
          throw ApiError.badRequest(`Unsupported security level: ${plugin.securityLevel}`);
      }

      const duration = Date.now() - startTime;

      execution.status = 'completed';
      execution.result = result;
      execution.duration = duration;
      execution.endTime = Date.now();

      logger.info('Plugin execution completed', {
        executionId,
        pluginId,
        functionName,
        duration,
        userId,
        resultSize: JSON.stringify(result).length
      });

      this.emit('plugin:executed', { executionId, pluginId, result, duration, userId });

      return {
        executionId,
        result,
        metadata: {
          duration,
          memoryUsed: execution.memoryUsed || 0,
          pluginName: plugin.name,
          pluginVersion: plugin.version
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      execution.status = 'failed';
      execution.error = error.message;
      execution.duration = duration;
      execution.endTime = Date.now();

      logger.error('Plugin execution failed', {
        executionId,
        pluginId,
        functionName,
        error: error.message,
        duration,
        userId
      });

      this.emit('plugin:execution_failed', { executionId, pluginId, error, duration, userId });

      throw ApiError.internalServerError(`Plugin execution failed: ${error.message}`);
    } finally {
      // Clean up execution record after delay
      setTimeout(() => {
        this.executions.delete(executionId);
      }, 300000); // Keep for 5 minutes
    }
  }

  /**
   * Execute plugin in trusted environment (direct execution)
   */
  async executeTrustedPlugin(plugin, functionName, parameters, execution) {
    // Load plugin module directly (highest risk, highest performance)
    const pluginModule = await import(path.join(plugin.installPath, 'index.js'));
    
    if (!pluginModule[functionName]) {
      throw new Error(`Function ${functionName} not found in plugin`);
    }

    // Set up execution context
    const context = {
      plugin: {
        id: plugin.id,
        name: plugin.name,
        config: plugin.configuration
      },
      user: { id: execution.userId },
      logger: this.createPluginLogger(plugin.id, execution.id)
    };

    return await pluginModule[functionName](parameters, context);
  }

  /**
   * Execute plugin in sandboxed environment (worker threads)
   */
  async executeSandboxedPlugin(plugin, functionName, parameters, execution) {
    return new Promise((resolve, reject) => {
      const sandbox = this.sandboxes.get(plugin.id);
      if (!sandbox) {
        return reject(new Error('Plugin sandbox not found'));
      }

      const worker = new Worker(sandbox.workerScript, {
        workerData: {
          pluginPath: plugin.installPath,
          functionName,
          parameters,
          config: plugin.configuration,
          permissions: plugin.permissions,
          executionId: execution.id
        }
      });

      const timeoutHandle = setTimeout(() => {
        worker.terminate();
        reject(new Error('Plugin execution timeout'));
      }, execution.timeout);

      worker.on('message', (result) => {
        clearTimeout(timeoutHandle);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          execution.memoryUsed = result.memoryUsed;
          resolve(result.data);
        }
      });

      worker.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeoutHandle);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Execute plugin in isolated environment (separate process)
   */
  async executeIsolatedPlugin(plugin, functionName, parameters, execution) {
    return new Promise((resolve, reject) => {
      const isolatedRunner = path.join(__dirname, 'isolated-runner.js');
      
      const child = spawn('node', [isolatedRunner], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PLUGIN_PATH: plugin.installPath,
          FUNCTION_NAME: functionName,
          MAX_MEMORY: execution.maxMemory.toString(),
          EXECUTION_ID: execution.id
        }
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error('Invalid JSON response from plugin'));
          }
        } else {
          reject(new Error(`Plugin execution failed with code ${code}: ${errorOutput}`));
        }
      });

      // Send parameters to child process
      child.stdin.write(JSON.stringify(parameters));
      child.stdin.end();

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Plugin execution timeout'));
      }, execution.timeout);

      child.on('exit', () => {
        clearTimeout(timeoutHandle);
      });
    });
  }

  /**
   * Execute plugin with strict restrictions
   */
  async executeRestrictedPlugin(plugin, functionName, parameters, execution) {
    // Most restrictive execution - only allow pure functions with minimal API
    const allowedAPIs = ['Math', 'Date', 'JSON', 'String', 'Array', 'Object'];
    
    // Create restricted context
    const restrictedGlobal = {};
    allowedAPIs.forEach(api => {
      restrictedGlobal[api] = global[api];
    });

    // Load and execute plugin in restricted context
    const pluginCode = await fs.readFile(path.join(plugin.installPath, 'index.js'), 'utf8');
    
    // Create VM-like execution (simplified version)
    const context = {
      ...restrictedGlobal,
      parameters,
      config: plugin.configuration,
      result: null,
      error: null
    };

    try {
      // This is a simplified example - in reality would use vm module or similar
      const func = new Function('context', `
        with(context) {
          ${pluginCode}
          if (typeof ${functionName} === 'function') {
            result = ${functionName}(parameters);
          } else {
            throw new Error('Function not found');
          }
        }
      `);

      func(context);

      if (context.error) {
        throw new Error(context.error);
      }

      return context.result;

    } catch (error) {
      throw new Error(`Restricted execution failed: ${error.message}`);
    }
  }

  /**
   * Create sandbox environment for plugin
   */
  async createPluginSandbox(pluginId, plugin) {
    const sandboxDir = path.join(this.sandboxDirectory, pluginId);
    await fs.ensureDir(sandboxDir);

    // Create worker script for sandboxed execution
    const workerScript = path.join(sandboxDir, 'worker.js');
    const workerCode = `
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');

async function executePlugin() {
  try {
    const { pluginPath, functionName, parameters, config, permissions, executionId } = workerData;
    
    // Monitor memory usage
    const initialMemory = process.memoryUsage();
    
    // Load plugin
    const pluginModule = require(path.join(pluginPath, 'index.js'));
    
    if (!pluginModule[functionName]) {
      throw new Error(\`Function \${functionName} not found\`);
    }
    
    // Create context
    const context = {
      config,
      permissions,
      executionId,
      logger: {
        info: (msg) => console.log(\`[INFO] \${msg}\`),
        error: (msg) => console.error(\`[ERROR] \${msg}\`),
        debug: (msg) => console.log(\`[DEBUG] \${msg}\`)
      }
    };
    
    // Execute function
    const result = await pluginModule[functionName](parameters, context);
    
    // Calculate memory usage
    const finalMemory = process.memoryUsage();
    const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
    
    parentPort.postMessage({
      data: result,
      memoryUsed
    });
    
  } catch (error) {
    parentPort.postMessage({
      error: error.message
    });
  }
}

executePlugin();
`;

    await fs.writeFile(workerScript, workerCode);

    const sandbox = {
      id: pluginId,
      directory: sandboxDir,
      workerScript,
      createdAt: new Date(),
      permissions: plugin.permissions,
      securityLevel: plugin.securityLevel
    };

    this.sandboxes.set(pluginId, sandbox);

    logger.info('Plugin sandbox created', {
      pluginId,
      sandboxDir,
      securityLevel: plugin.securityLevel
    });

    return sandbox;
  }

  /**
   * Security assessment of plugin
   */
  async assessPluginSecurity(files, manifest) {
    const assessment = {
      riskLevel: 'low',
      vulnerabilities: [],
      permissions: [],
      networkAccess: false,
      fileSystemAccess: false,
      dangerousAPIs: [],
      codeComplexity: 'low',
      summary: ''
    };

    // Analyze files for security risks
    for (const file of files) {
      if (file.endsWith('.js')) {
        const content = await fs.readFile(file, 'utf8');
        
        // Check for dangerous APIs
        const dangerousPatterns = [
          /require\s*\(\s*['"]child_process['"]\s*\)/,
          /require\s*\(\s*['"]fs['"]\s*\)/,
          /require\s*\(\s*['"]net['"]\s*\)/,
          /eval\s*\(/,
          /Function\s*\(/,
          /process\.exit/,
          /global\./
        ];

        dangerousPatterns.forEach((pattern, index) => {
          if (pattern.test(content)) {
            const apiNames = ['child_process', 'fs', 'net', 'eval', 'Function', 'process.exit', 'global'];
            assessment.dangerousAPIs.push(apiNames[index]);
          }
        });

        // Check for network access patterns
        if (/https?:\/\/|fetch\(|axios|request/.test(content)) {
          assessment.networkAccess = true;
        }

        // Check for file system access
        if (/writeFile|readFile|mkdir|rmdir/.test(content)) {
          assessment.fileSystemAccess = true;
        }
      }
    }

    // Assess permissions
    assessment.permissions = manifest.permissions || [];

    // Calculate risk level
    let riskScore = 0;
    riskScore += assessment.dangerousAPIs.length * 2;
    riskScore += assessment.networkAccess ? 1 : 0;
    riskScore += assessment.fileSystemAccess ? 1 : 0;
    riskScore += assessment.permissions.length;

    if (riskScore === 0) {
      assessment.riskLevel = 'low';
    } else if (riskScore <= 3) {
      assessment.riskLevel = 'medium';
    } else {
      assessment.riskLevel = 'high';
    }

    assessment.summary = `Risk Level: ${assessment.riskLevel}. ` +
      `Dangerous APIs: ${assessment.dangerousAPIs.length}. ` +
      `Network: ${assessment.networkAccess ? 'Yes' : 'No'}. ` +
      `File System: ${assessment.fileSystemAccess ? 'Yes' : 'No'}.`;

    return assessment;
  }

  // Helper methods continue...

  async validatePluginManifest(pluginDir) {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('Plugin manifest.json not found');
    }

    const manifest = await fs.readJson(manifestPath);

    // Validate required fields
    const requiredFields = ['name', 'version', 'description', 'main'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        throw new Error(`Required field '${field}' missing from manifest`);
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Invalid version format. Use semantic versioning (x.y.z)');
    }

    return manifest;
  }

  validatePluginExecution(plugin, functionName, parameters, options) {
    // Check if function is allowed
    if (plugin.manifest.functions && !plugin.manifest.functions.includes(functionName)) {
      throw ApiError.forbidden(`Function '${functionName}' not allowed for this plugin`);
    }

    // Check permissions
    if (options.allowNetworkAccess && !plugin.permissions.includes('network_access')) {
      throw ApiError.forbidden('Plugin does not have network access permission');
    }

    if (options.allowFileSystemAccess && !plugin.permissions.includes('file_system_access')) {
      throw ApiError.forbidden('Plugin does not have file system access permission');
    }

    return true;
  }

  normalizePermissions(permissions) {
    const validPermissions = [
      'read_conversations',
      'write_conversations',
      'access_files',
      'network_access',
      'system_access',
      'user_data',
      'file_system_access'
    ];

    return permissions.filter(p => validPermissions.includes(p));
  }

  canAutoApprove(plugin) {
    return plugin.securityAssessment.riskLevel === 'low' && 
           plugin.securityAssessment.dangerousAPIs.length === 0;
  }

  createPluginLogger(pluginId, executionId) {
    return {
      info: (msg) => logger.info(`[Plugin:${pluginId}:${executionId}] ${msg}`),
      error: (msg) => logger.error(`[Plugin:${pluginId}:${executionId}] ${msg}`),
      debug: (msg) => logger.debug(`[Plugin:${pluginId}:${executionId}] ${msg}`)
    };
  }

  // ID generators and utility methods
  generatePluginId() {
    return `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async calculateDirectorySize(dir) {
    let size = 0;
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        size += await this.calculateDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    }
    
    return size;
  }

  async calculatePluginChecksum(dir) {
    // Calculate SHA-256 checksum of all plugin files
    const hash = crypto.createHash('sha256');
    const files = await this.getAllFiles(dir);
    
    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  async getAllFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // Public API methods
  async approvePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw ApiError.notFound(`Plugin ${pluginId} not found`);
    }

    plugin.status = 'active';
    plugin.approvedAt = new Date();
    
    await this.savePluginRegistry();
    
    this.emit('plugin:approved', { pluginId, plugin });
    
    return plugin;
  }

  async uninstallPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw ApiError.notFound(`Plugin ${pluginId} not found`);
    }

    // Clean up sandbox
    const sandbox = this.sandboxes.get(pluginId);
    if (sandbox) {
      await fs.remove(sandbox.directory);
      this.sandboxes.delete(pluginId);
    }

    // Remove plugin files
    await fs.remove(plugin.installPath);

    // Remove from registry
    this.plugins.delete(pluginId);
    await this.savePluginRegistry();

    this.emit('plugin:uninstalled', { pluginId, plugin });

    return true;
  }

  getPluginStatus(pluginId) {
    return this.plugins.get(pluginId);
  }

  listPlugins(filters = {}) {
    let plugins = Array.from(this.plugins.values());

    if (filters.status) {
      plugins = plugins.filter(p => p.status === filters.status);
    }

    if (filters.securityLevel) {
      plugins = plugins.filter(p => p.securityLevel === filters.securityLevel);
    }

    if (filters.userId) {
      plugins = plugins.filter(p => p.installedBy === filters.userId);
    }

    return plugins;
  }

  getExecutionHistory(pluginId) {
    return Array.from(this.executions.values()).filter(e => e.pluginId === pluginId);
  }

  async savePluginRegistry() {
    const registryPath = path.join(this.pluginDirectory, 'registry.json');
    const registry = Object.fromEntries(this.plugins);
    await fs.writeJson(registryPath, registry, { spaces: 2 });
  }

  async loadExistingPlugins() {
    const registryPath = path.join(this.pluginDirectory, 'registry.json');
    
    if (await fs.pathExists(registryPath)) {
      try {
        const registry = await fs.readJson(registryPath);
        this.plugins = new Map(Object.entries(registry));
      } catch (error) {
        logger.error('Failed to load plugin registry', { error: error.message });
      }
    }
  }

  setupSecurityPolicies() {
    // Define security policies for different levels
    this.securityPolicies.set('trusted', {
      allowedAPIs: '*',
      networkAccess: true,
      fileSystemAccess: true,
      memoryLimit: 1024 * 1024 * 1024, // 1GB
      timeoutLimit: 300000 // 5 minutes
    });

    this.securityPolicies.set('sandboxed', {
      allowedAPIs: ['console', 'Math', 'Date', 'JSON'],
      networkAccess: false,
      fileSystemAccess: false,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      timeoutLimit: 30000 // 30 seconds
    });

    this.securityPolicies.set('restricted', {
      allowedAPIs: ['Math', 'Date', 'JSON'],
      networkAccess: false,
      fileSystemAccess: false,
      memoryLimit: 50 * 1024 * 1024, // 50MB
      timeoutLimit: 10000 // 10 seconds
    });
  }

  async downloadPlugin(source, installDir) {
    // Mock implementation - in reality would handle various sources
    // (Git repos, npm packages, direct uploads, etc.)
    
    if (source.startsWith('http')) {
      // Download from URL
      throw new Error('URL-based plugin installation not implemented yet');
    } else if (source.startsWith('git+')) {
      // Clone from Git repository
      throw new Error('Git-based plugin installation not implemented yet');
    } else {
      // Assume local file path or uploaded files
      return [path.join(installDir, 'index.js')];
    }
  }
}