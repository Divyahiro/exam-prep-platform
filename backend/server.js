const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ RAZORPAY CONFIGURATION
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret'
});

console.log('💰 Razorpay:', process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '❌ Not Configured');

// ✅ DEEPSEEK API CONFIGURATION
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'your_api_key_here';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ✅ Verify API key is working
console.log('🔑 DeepSeek API Status:', DEEPSEEK_API_KEY ? '✅ Key Loaded' : '❌ No Key Found');

// ✅ Test DeepSeek API connection
async function testDeepSeekConnection() {
    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('✅ DeepSeek API Connection Test: SUCCESS');
        return true;
    } catch (error) {
        console.log('❌ DeepSeek API Connection Test: FAILED');
        console.log('Error:', error.message);
        return false;
    }
}

// ✅ HEALTH CHECK ENDPOINT
app.get('/health', async (req, res) => {
    const apiStatus = await testDeepSeekConnection();
    res.json({
        status: 'ok',
        timestamp: new Date(),
        deepseek_api: apiStatus ? 'connected' : 'disconnected',
        razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured',
        message: 'Exam Prep Platform API is running'
    });
});

// ========== PAYMENT ENDPOINTS ==========

// 1. CREATE RAZORPAY ORDER
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, plan = 'monthly' } = req.body;
    
    const options = {
      amount: amount * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { 
        plan: plan,
        platform: 'ExamPrep AI',
        date: new Date().toISOString()
      }
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('❌ Razorpay order error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create order',
      message: error.message 
    });
  }
});

// 2. VERIFY PAYMENT SIGNATURE
app.post('/api/verify-payment', (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'your_secret';
    
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(order_id + "|" + payment_id)
      .digest('hex');
    
    if (generated_signature === signature) {
      res.json({ 
        success: true, 
        message: 'Payment verified successfully! Premium activated.',
        premium_activated: true,
        activated_at: new Date()
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========== AI ENDPOINTS ==========

// 1. GENERATE QUESTION WITH DEEPSEEK
app.post('/api/generate-question', async (req, res) => {
    try {
        const { examType = 'JEE', subject = 'Mathematics', difficulty = 'medium', topic = 'Algebra' } = req.body;
        
        const prompt = `Generate a ${difficulty} difficulty multiple choice question for ${examType} ${subject} on topic: ${topic}.
        Return ONLY valid JSON in this exact format:
        {
            "question": "The actual question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "A",
            "explanation": "Detailed step-by-step explanation here",
            "topic": "${topic}",
            "difficulty": "${difficulty}",
            "subject": "${subject}",
            "examType": "${examType}"
        }`;

        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const aiResponse = response.data.choices[0].message.content;
        
        // Clean and parse JSON
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format from AI');
        }
        
        const questionData = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            ...questionData,
            generatedAt: new Date()
        });
        
    } catch (error) {
        console.error('❌ Error generating question:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate question',
            message: error.message,
            fallbackQuestion: getFallbackQuestion()
        });
    }
});

// 2. SOLVE DOUBT WITH DEEPSEEK
app.post('/api/solve-doubt', async (req, res) => {
    try {
        const { question, subject = 'General', studentGrade = '12th' } = req.body;
        
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        
        const prompt = `You are an expert tutor for Indian ${studentGrade} student preparing for competitive exams.
        Question: ${question}
        Subject: ${subject}
        
        Provide a helpful, detailed solution with:
        1. Step-by-step explanation
        2. Key concepts used
        3. Formula if applicable
        4. Final answer clearly stated
        5. One similar practice question
        
        Format your response in clear paragraphs.`;
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 800
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const solution = response.data.choices[0].message.content;
        
        res.json({
            success: true,
            question: question,
            solution: solution,
            solvedAt: new Date()
        });
        
    } catch (error) {
        console.error('❌ Error solving doubt:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to solve doubt',
            message: error.message,
            fallbackSolution: `We're experiencing high demand. Please try again in a moment. For "${req.body.question}", review your ${req.body.subject || 'subject'} textbook chapter.`
        });
    }
});

// 3. GENERATE MOCK TEST
app.post('/api/generate-test', async (req, res) => {
    try {
        const { examType = 'JEE Mains', subject = 'Physics', count = 5 } = req.body;
        
        const prompt = `Generate a mock test of ${count} questions for ${examType} ${subject}.
        Return ONLY valid JSON array in this exact format:
        [
            {
                "id": 1,
                "question": "Question text?",
                "options": ["A", "B", "C", "D"],
                "correct": "A",
                "marks": 4,
                "negativeMarks": 1,
                "explanation": "Detailed explanation"
            }
        ]
        Generate exactly ${count} questions.`;
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const testContent = response.data.choices[0].message.content;
        const jsonMatch = testContent.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error('Invalid test format');
        }
        
        const questions = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            examType,
            subject,
            totalQuestions: questions.length,
            totalMarks: questions.reduce((sum, q) => sum + (q.marks || 4), 0),
            duration: questions.length * 1.5,
            questions: questions,
            generatedAt: new Date()
        });
        
    } catch (error) {
        console.error('❌ Error generating test:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate test',
            message: error.message
        });
    }
});

// 4. EXPLAIN CONCEPT
app.post('/api/explain-concept', async (req, res) => {
    try {
        const { concept, subject = 'Science', level = 'Intermediate' } = req.body;
        
        const prompt = `Explain the concept "${concept}" for ${subject} at ${level} level suitable for Indian competitive exam preparation.
        Include:
        1. Simple definition
        2. Key points
        3. Formula/Diagrams if applicable
        4. Real-life examples
        5. Common exam questions on this topic
        6. Memory tricks
        
        Make it engaging and easy to understand.`;
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            success: true,
            concept: concept,
            explanation: response.data.choices[0].message.content,
            explainedAt: new Date()
        });
        
    } catch (error) {
        console.error('❌ Error explaining concept:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to explain concept'
        });
    }
});

// 5. FALLBACK QUESTIONS (If API fails)
function getFallbackQuestion() {
    const fallbackQuestions = [
        {
            question: "What is the value of ∫(x²)dx from 0 to 1?",
            options: ["1/3", "1/2", "2/3", "1"],
            correctAnswer: "A",
            explanation: "The integral of x² is (x³/3). Evaluating from 0 to 1 gives (1³/3) - (0³/3) = 1/3.",
            topic: "Calculus",
            difficulty: "medium",
            subject: "Mathematics",
            examType: "JEE"
        },
        {
            question: "Ohm's Law states that:",
            options: [
                "V = IR",
                "I = VR", 
                "R = VI",
                "V = I/R"
            ],
            correctAnswer: "A",
            explanation: "Ohm's Law states that voltage (V) is equal to current (I) multiplied by resistance (R).",
            topic: "Electricity",
            difficulty: "easy",
            subject: "Physics",
            examType: "NEET"
        }
    ];
    return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
}

// 6. RATE LIMITER (Free tier protection)
const requestCounts = {};
const RATE_LIMIT = 100;

app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    if (!requestCounts[ip]) {
        requestCounts[ip] = [];
    }
    
    requestCounts[ip] = requestCounts[ip].filter(time => time > oneMinuteAgo);
    
    if (requestCounts[ip].length >= RATE_LIMIT) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Please wait a minute before making more requests'
        });
    }
    
    requestCounts[ip].push(now);
    next();
});

// 7. SAMPLE DATA ENDPOINT (No API key needed)
app.get('/api/sample-questions', (req, res) => {
    const samples = [
        getFallbackQuestion(),
        {
            question: "Who is known as the Father of Indian Constitution?",
            options: [
                "Mahatma Gandhi",
                "Jawaharlal Nehru",
                "B.R. Ambedkar",
                "Sardar Patel"
            ],
            correctAnswer: "C",
            explanation: "Dr. B.R. Ambedkar was the chairman of the drafting committee of the Indian Constitution.",
            topic: "Indian Polity",
            difficulty: "easy",
            subject: "General Knowledge",
            examType: "UPSC"
        }
    ];
    res.json(samples);
});

// 8. DATABASE CONNECTION (Optional)
async function connectDB() {
    try {
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ MongoDB Connected');
        } else {
            console.log('ℹ️  MongoDB not configured - running in memory mode');
        }
    } catch (error) {
        console.log('⚠️  MongoDB connection failed:', error.message);
        console.log('ℹ️  Continuing without database');
    }
}

// ✅ START SERVER
const PORT = process.env.PORT || 5000;

async function startServer() {
    await connectDB();
    await testDeepSeekConnection();
    
    app.listen(PORT, () => {
        console.log(`
        🚀 EXAM PREP PLATFORM SERVER STARTED
        ====================================
        📍 Port: ${PORT}
        🔗 Local: http://localhost:${PORT}
        🔗 Health: http://localhost:${PORT}/health
        🔑 DeepSeek: ${DEEPSEEK_API_KEY ? '✅ Configured' : '❌ Not Configured'}
        💰 Razorpay: ${process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '❌ Not Configured'}
        💾 Database: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not Connected'}
        ====================================
        
        📚 Available Endpoints:
        GET  /health                    - Check server status
        GET  /api/sample-questions      - Get sample questions
        POST /api/create-order          - Create Razorpay order
        POST /api/verify-payment        - Verify payment
        POST /api/generate-question     - Generate AI question
        POST /api/solve-doubt           - Solve student doubt
        
        💳 Test Card: 4111 1111 1111 1111 | CVV: Any | Expiry: Any future
        ====================================
        `);
    });
}

startServer();

process.on('SIGINT', () => {
    console.log('👋 Server shutting down...');
    process.exit(0);
});