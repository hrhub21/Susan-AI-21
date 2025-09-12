import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { PluginService } from '../services/PluginService.js';

export class PluginController {
  constructor() {
    this.pluginService = new PluginService();
  }

  async listPlugins(req, res) {
    const { status = 'all', category, search } = req.query;
    const userId = this.getUserId(req);

    try {
      const plugins = await this.pluginService.listPlugins({
        userId,
        status,
        category,
        search
      });

      res.json({
        success: true,
        data: {
          plugins,
          total: plugins.length
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getMarketplace(req, res) {
    const { category, search, sortBy = 'name' } = req.query;

    try {
      const plugins = await this.pluginService.getMarketplace({
        category,
        search,
        sortBy
      });

      res.json({
        success: true,
        data: {
          plugins,
          categories: await this.pluginService.getCategories()
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async installPlugin(req, res) {
    const { pluginId, version, configuration = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      const result = await this.pluginService.installPlugin({
        userId,
        pluginId,
        version,
        configuration
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Plugin installed successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getPlugin(req, res) {
    const { pluginId } = req.params;
    const userId = this.getUserId(req);

    try {
      const plugin = await this.pluginService.getPlugin(pluginId, userId);
      
      if (!plugin) {
        throw ApiError.notFound('Plugin not found');
      }

      res.json({
        success: true,
        data: plugin,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async updatePlugin(req, res) {
    const { pluginId } = req.params;
    const { status, configuration, settings } = req.body;
    const userId = this.getUserId(req);

    try {
      const updatedPlugin = await this.pluginService.updatePlugin(pluginId, userId, {
        status,
        configuration,
        settings
      });

      if (!updatedPlugin) {
        throw ApiError.notFound('Plugin not found');
      }

      res.json({
        success: true,
        data: updatedPlugin,
        message: 'Plugin updated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async uninstallPlugin(req, res) {
    const { pluginId } = req.params;
    const userId = this.getUserId(req);

    try {
      const result = await this.pluginService.uninstallPlugin(pluginId, userId);
      
      if (!result) {
        throw ApiError.notFound('Plugin not found');
      }

      res.status(204).send();
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async executePlugin(req, res) {
    const { pluginId } = req.params;
    const { function: functionName, parameters = {}, timeout = 10000 } = req.body;
    const userId = this.getUserId(req);

    try {
      const result = await this.pluginService.executePlugin(pluginId, userId, {
        functionName,
        parameters,
        timeout
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getPluginLogs(req, res) {
    const { pluginId } = req.params;
    const { limit = 100, level, startDate, endDate } = req.query;
    const userId = this.getUserId(req);

    try {
      const logs = await this.pluginService.getPluginLogs(pluginId, userId, {
        limit: parseInt(limit),
        level,
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getPluginMetrics(req, res) {
    const { pluginId } = req.params;
    const { timeframe = 'day' } = req.query;
    const userId = this.getUserId(req);

    try {
      const metrics = await this.pluginService.getPluginMetrics(pluginId, userId, {
        timeframe
      });

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async testPlugin(req, res) {
    const { pluginId } = req.params;
    const { testType = 'health', parameters = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      const result = await this.pluginService.testPlugin(pluginId, userId, {
        testType,
        parameters
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  getUserId(req) {
    if (req.auth?.user?.id) {
      return req.auth.user.id;
    }
    
    if (req.auth?.key) {
      // For API key auth, use a derived user ID or default
      return `api_user_${req.auth.key.slice(-8)}`;
    }
    
    throw ApiError.unauthorized('User identification required');
  }
}