# Susan AI 21 - Advanced Roofing Intelligence System

An enterprise-grade AI assistant specialized for the roofing industry, featuring advanced photo analysis, multi-language support, and comprehensive business intelligence capabilities.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start

# Access the interface
open http://localhost:3000
```

## 🎯 Core Features

### AI-Powered Capabilities
- **Photo Analysis**: Advanced damage detection and roof assessment using computer vision
- **Voice Assistant**: Natural language processing with voice commands
- **Multi-Language Support**: Full support for English, Spanish, and other languages
- **Real-Time Chat**: WebSocket-based instant communication

### Business Intelligence
- **Insurance Integration**: Automated claim processing and documentation
- **Weather Analysis**: Real-time weather impact assessment
- **Building Codes**: Comprehensive code compliance verification
- **Legal Precedents**: Access to relevant case law and regulations
- **Predictive Analytics**: Forecasting and trend analysis

### Enterprise Features
- **Role-Based Access Control (RBAC)**: Secure multi-user management
- **Training System**: Interactive modules for team education
- **OCR Processing**: Document and image text extraction
- **API Integrations**: Hover, EagleView, and custom APIs

## 📁 Project Structure

```
Susan-AI-21/
├── src/                    # Source code
│   ├── api/               # API endpoints
│   ├── services/          # Business logic
│   ├── utils/             # Utilities
│   └── agents/            # AI agents
├── public/                # Static files
├── data/                  # Data storage
├── training/              # Training modules
├── tests/                 # Test suites
├── plugins/               # Extensions
└── docs/                  # Documentation
```

## 🔧 Configuration

### Required API Keys
- `OPENAI_API_KEY` - OpenAI API access
- `ANTHROPIC_API_KEY` - Claude API access
- `WEATHER_API_KEY` - Weather service
- `HOVER_API_KEY` - Hover integration (optional)
- `EAGLEVIEW_API_KEY` - EagleView integration (optional)

### Database Setup
```bash
# PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/susan_ai
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
```

## 📚 API Documentation

### REST Endpoints
- `POST /api/analyze-photo` - Photo analysis
- `POST /api/chat` - Chat interaction
- `GET /api/weather` - Weather data
- `POST /api/translate` - Translation service

### WebSocket Events
- `connection` - Client connected
- `message` - Chat message
- `analysis` - Photo analysis result
- `voice` - Voice command

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For support, email support@roofer21.com or visit our [documentation](https://docs.roofer21.com).

## 🚀 Deployment

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

### Docker Deployment
```bash
# Build Docker image
docker build -t susan-ai-21 .

# Run container
docker run -p 3000:3000 susan-ai-21
```

---

**Version**: 2.0.0  
**Last Updated**: September 2025  
**Maintained by**: RoofER21 Team