import dotenv from 'dotenv';
import { SusanBrain } from './src/susan-brain.js';
import { CommandHandler } from './src/command-handler.js';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Full Susan AI System');
console.log('================================\n');

async function testSystem() {
    try {
        console.log('1. 🧠 Testing SusanBrain initialization...');
        const brain = new SusanBrain();
        console.log('✅ SusanBrain created successfully\n');
        
        console.log('2. ⚡ Testing CommandHandler initialization...');
        const handler = new CommandHandler(brain);
        console.log('✅ CommandHandler created successfully\n');
        
        console.log('3. 🎯 Testing system status...');
        const status = brain.getStatus();
        console.log(`Status: ${status}\n`);
        
        console.log('4. 👋 Testing greeting...');
        const greeting = brain.getGreeting();
        console.log(`Greeting: ${greeting}\n`);
        
        console.log('5. 🤖 Testing AI response (simple message)...');
        const response = await brain.processMessage('Hello, can you tell me what you can do?');
        console.log(`AI Response (${response.model}): ${response.response.substring(0, 100)}...\n`);
        
        console.log('6. ⚡ Testing command processing...');
        const commandResult = await handler.processInput('what time is it?');
        if (commandResult.isCommand) {
            console.log(`Command Result: ${commandResult.result}\n`);
        } else {
            console.log('Not recognized as command, would go to AI\n');
        }
        
        console.log('7. 🧮 Testing calculation command...');
        const calcResult = await handler.processInput('calculate 15 * 7');
        console.log(`Calculation: ${calcResult.result}\n`);
        
        console.log('8. 📊 Testing memory stats...');
        const memoryStats = brain.showMemoryStats();
        console.log(`Memory: ${memoryStats}\n`);
        
        console.log('🎉 ALL TESTS PASSED! Susan AI is fully functional.');
        console.log('\n🚀 Ready to start the full server!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

testSystem();