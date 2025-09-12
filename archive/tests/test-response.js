// Quick test of response processing logic
import { SusanBrain } from './src/susan-brain.js';
import dotenv from 'dotenv';

dotenv.config();

async function testResponse() {
    try {
        console.log('🧠 Initializing Susan Brain...');
        const susan = new SusanBrain();
        
        console.log('🔄 Testing casual company question...');
        const response = await susan.processMessage('do you know any roof er employees');
        
        console.log('\n📝 Response:');
        console.log(response.response);
        console.log('\n📊 Model:', response.model);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    process.exit(0);
}

testResponse();