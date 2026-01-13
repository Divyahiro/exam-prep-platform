import React, { useState } from 'react';
import { Brain, Trophy, Clock, BarChart3, BookOpen } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('practice');
  const [userLevel, setUserLevel] = useState('beginner');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Brain className="w-8 h-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-800">
                ExamPrep AI
              </span>
            </div>
            <div className="flex space-x-6">
              {['JEE', 'NEET', 'UPSC', 'SSC', 'CAT'].map((exam) => (
                <button key={exam} className="font-medium hover:text-indigo-600">
                  {exam}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Dashboard */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-bold text-lg mb-3">Quick Actions</h3>
              {[
                { icon: BookOpen, label: 'Practice Questions', tab: 'practice' },
                { icon: Clock, label: 'Mock Tests', tab: 'tests' },
                { icon: BarChart3, label: 'Progress', tab: 'progress' },
                { icon: Trophy, label: 'Leaderboard', tab: 'leaderboard' },
                { icon: Brain, label: 'AI Tutor', tab: 'tutor' }
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`flex items-center space-x-3 w-full p-3 rounded-lg mb-2 ${activeTab === item.tab ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Difficulty Level */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-bold text-lg mb-3">Difficulty</h3>
              {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((level) => (
                <button
                  key={level}
                  onClick={() => setUserLevel(level.toLowerCase())}
                  className={`block w-full text-left p-2 rounded ${userLevel === level.toLowerCase() ? 'bg-indigo-100' : ''}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {activeTab === 'practice' && <PracticeQuestions />}
            {activeTab === 'tests' && <MockTests />}
            {activeTab === 'tutor' && <AITutor />}
            {activeTab === 'progress' && <ProgressTracker />}
            {activeTab === 'leaderboard' && <Leaderboard />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Practice Questions Component
function PracticeQuestions() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const generateQuestion = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/sample-questions');
    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      setCurrentQuestion(data[0]);
      setShowExplanation(false);
    }
  } catch (error) {
    console.log('Using fallback question');
    setCurrentQuestion({
      question: "What is Newton's First Law of Motion?",
      options: [
        "An object at rest stays at rest",
        "Force = mass × acceleration", 
        "Every action has equal reaction",
        "Energy cannot be created"
      ],
      explanation: "Newton's First Law: An object remains at rest or in uniform motion unless acted upon by a force."
    });
  }
};

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Practice Questions</h2>
        <button
          onClick={generateQuestion}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Generate New Question
        </button>
      </div>

      {currentQuestion ? (
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">
              {currentQuestion.question}
            </h3>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full text-left p-3 rounded-lg border ${selectedOption === option ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg">
              Submit Answer
            </button>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Show Explanation
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg">
              Ask AI Tutor
            </button>
          </div>

          {showExplanation && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-bold mb-2">Explanation:</h4>
              <p>{currentQuestion.explanation}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Click "Generate New Question" to start practicing!</p>
        </div>
      )}
    </div>
  );
}

// AI Tutor Component
function AITutor() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');

  const askTutor = async () => {
    const res = await fetch('/api/solve-doubt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: query,
        subject: 'Mathematics',
        studentGrade: '12th'
      })
    });
    const data = await res.json();
    setResponse(data.solution);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">AI Tutor - Ask Anything!</h2>
      <div className="space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-32 p-4 border rounded-lg"
          placeholder="Type your doubt here... Example: Explain quantum physics for NEET preparation"
        />
        <button
          onClick={askTutor}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
        >
          Ask AI Tutor
        </button>
        
        {response && (
          <div className="bg-gray-50 p-6 rounded-lg mt-6">
            <h3 className="font-bold mb-4">AI Tutor Response:</h3>
            <div className="prose max-w-none">
              {response.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function MockTests() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Mock Tests</h2>
      <p>Take timed mock tests for JEE, NEET, UPSC and more!</p>
      <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg">
        Start New Test
      </button>
    </div>
  );
}

function ProgressTracker() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Progress Tracker</h2>
      <p>Your Performance:</p>
      <div className="mt-4 space-y-2">
        <div>✅ Questions Attempted: 25</div>
        <div>📊 Accuracy: 72%</div>
        <div>⏱️ Time Spent: 5 hours</div>
      </div>
    </div>
  );
}

function Leaderboard() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <div className="space-y-2">
        <div>🥇 Rohan Sharma - 95%</div>
        <div>🥈 Priya Patel - 92%</div>
        <div>🥉 Amit Kumar - 89%</div>
      </div>
    </div>
  );
}
export default App;