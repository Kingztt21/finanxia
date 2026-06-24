// ================================
// Configuration
// ================================

// API is called through server proxy for security
const API_ENDPOINT = '/api/chat';

// ================================
// Chat Functionality (only for chat.html)
// ================================

// Check if we're on the chat page
const isChatPage = typeof document !== 'undefined' && document.getElementById('chatMessages') !== null;

// Initialize chat if on chat page
let conversationHistory = [
    {
                role: 'system',
                content: `Você é uma assistente especializada em contabilidade brasileira. Seu nome é FinanxIA.

IMPORTANTE - CAPACIDADES ESPECIAIS:
Você pode criar visualizações interativas! Quando apropriado, use estas funções:

1. Para GRÁFICOS, responda com:
[CHART]
type: bar|line|pie|doughnut
title: Título do Gráfico
labels: ["Label1", "Label2", "Label3"]
data: [valor1, valor2, valor3]
label: Nome do Dataset
[/CHART]

2. Para TABELAS, responda com:
[TABLE]
headers: ["Coluna1", "Coluna2", "Coluna3"]
rows: [
    ["Valor1A", "Valor1B", "Valor1C"],
    ["Valor2A", "Valor2B", "Valor2C"]
]
[/TABLE]

3. Para CÁLCULOS, mostre com:
[CALC]
título: Nome do Cálculo
item1: Descrição = R$ valor
item2: Descrição = valor%
total: Total = R$ valor
[/CALC]

4. Para FLUXOGRAMAS, responda com um bloco Mermaid dentro de tags \`[FLOW]\`:
[FLOW]
graph TD
A[Início] --> B[Passo 1]
B --> C[Decisão?]
C -->|Sim| D[Passo Sim]
C -->|Não| E[Passo Não]
[/FLOW]

5. Para MAPAS MENTAIS, responda com um bloco Mermaid dentro de tags \`[MINDMAP]\` usando a sintaxe \`mindmap\`:
[MINDMAP]
mindmap
    root
        Ideia Principal
            Ramificação A
            Ramificação B
[/MINDMAP]

DIRETRIZES:
- Seja precisa e atualizada com a legislação brasileira
- Use estas funções sempre que ajudar na compreensão
- Explique conceitos complexos de forma clara
- Sugira soluções práticas e aplicáveis
- Sempre que mencionar valores, prazos ou datas, seja específica
- Use gráficos para comparações e evolução temporal
- Use tabelas para listas de informações estruturadas
- Use cálculos para demonstrar apurações de impostos
- Para fluxogramas e mapas mentais, gere sintaxe Mermaid válida dentro dos blocos \`[FLOW]\` ou \`[MINDMAP]\`.

Responda de forma profissional, mas acessível.`
    }
];

// Variáveis globais para chat
let chatMessages, messageInput, sendBtn;

// Inicializar chat quando página estiver pronta
if (isChatPage) {
    chatMessages = document.getElementById('chatMessages');
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    
    // Setar up initial state
    if (messageInput) {
        messageInput.disabled = false;
        sendBtn.disabled = true;
    }
}

// ================================
// Groq API Integration (via server proxy)
// ================================
async function callGroqAPI(message) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: conversationHistory
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[ERROR] API Error:', error);
            if (response.status === 500 && error.error?.includes('API key')) {
                return '⚠️ Erro: A chave da API Groq não foi configurada no servidor. Verifique a variável de ambiente GROQ_API_KEY.';
            }
            return `❌ Erro da API: ${error.error || 'Erro desconhecido'}`;
        }

        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        }
        return 'Erro ao processar resposta da API';
    } catch (error) {
        console.error('[ERROR] Groq API Error:', error);
        return `❌ Erro na requisição: ${error.message}`;
    }
}

// ================================
// Message Rendering with Special Functions
// ================================

function parseAndRenderMessage(text) {
    let html = '';
    let lastIndex = 0;
    
    // Parse CHART / TABLE / CALC / FLOW / MINDMAP
    const chartRegex = /\[CHART\]([\s\S]*?)\[\/CHART\]/g;
    const tableRegex = /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g;
    const calcRegex = /\[CALC\]([\s\S]*?)\[\/CALC\]/g;
    const flowRegex = /\[FLOW\]([\s\S]*?)\[\/FLOW\]/g;
    const mindmapRegex = /\[MINDMAP\]([\s\S]*?)\[\/MINDMAP\]/g;
    
    let match;
    const elements = [];
    
    // Find all special elements
    while ((match = chartRegex.exec(text)) !== null) {
        elements.push({ type: 'chart', index: match.index, length: match[0].length, content: match[1] });
    }
    while ((match = tableRegex.exec(text)) !== null) {
        elements.push({ type: 'table', index: match.index, length: match[0].length, content: match[1] });
    }
    while ((match = calcRegex.exec(text)) !== null) {
        elements.push({ type: 'calc', index: match.index, length: match[0].length, content: match[1] });
    }
    while ((match = flowRegex.exec(text)) !== null) {
        elements.push({ type: 'flow', index: match.index, length: match[0].length, content: match[1] });
    }
    while ((match = mindmapRegex.exec(text)) !== null) {
        elements.push({ type: 'mindmap', index: match.index, length: match[0].length, content: match[1] });
    }
    
    // Sort by position
    elements.sort((a, b) => a.index - b.index);
    
    // Build HTML
    elements.forEach(element => {
        // Add text before this element
        html += escapeHtml(text.substring(lastIndex, element.index));
        
        // Add the special element
        if (element.type === 'chart') {
            html += renderChart(element.content);
        } else if (element.type === 'table') {
            html += renderTable(element.content);
        } else if (element.type === 'calc') {
            html += renderCalc(element.content);
        } else if (element.type === 'flow' || element.type === 'mindmap') {
            html += renderMermaid(element.content, element.type);
        }
        
        lastIndex = element.index + element.length;
    });
    
    // Add remaining text
    html += escapeHtml(text.substring(lastIndex));
    
    // Convert markdown-style formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    
    return html;
} 

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderChart(content) {
    const chartId = 'chart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const config = parseChartConfig(content);
    
    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            new Chart(canvas, {
                type: config.type,
                data: {
                    labels: config.labels,
                    datasets: [{
                        label: config.label,
                        data: config.data,
                        backgroundColor: [
                            'rgba(0, 119, 255, 0.7)',
                            'rgba(47, 0, 255, 0.7)',
                            'rgba(78, 205, 255, 0.7)',
                            'rgba(66, 135, 245, 0.7)',
                            'rgba(100, 125, 255, 0.7)',
                            'rgba(133, 183, 255, 0.7)',
                            'rgba(80, 96, 255, 0.7)',
                            'rgba(0, 146, 255, 0.7)',
                            'rgba(40, 89, 255, 0.7)',
                            'rgba(55, 140, 255, 0.7)',
                            'rgba(16, 14, 124, 0.7)',
                            'rgba(58, 72, 255, 0.7)'
                        ],
                        borderColor: [
                            'rgba(0, 119, 255, 1)',
                            'rgba(47, 0, 255, 1)',
                            'rgba(78, 205, 255, 1)',
                            'rgba(66, 135, 245, 1)',
                            'rgba(100, 125, 255, 1)',
                            'rgba(133, 183, 255, 1)',
                            'rgba(80, 96, 255, 1)',
                            'rgba(0, 146, 255, 1)',
                            'rgba(40, 89, 255, 1)',
                            'rgba(55, 140, 255, 1)',
                            'rgba(16, 14, 124, 1)',
                            'rgba(58, 72, 255, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                color: '#1a1a1a',
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                padding: 15
                            }
                        },
                        title: {
                            display: true,
                            text: config.title,
                            color: '#1a1a1a',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        }
                    },
                    scales: config.type === 'bar' || config.type === 'line' ? {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#1a1a1a',
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#1a1a1a',
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    } : {}
                }
            });
        }
    }, 100);
    
    return `<div class="chart-container" style="margin: 1rem 0; padding: 1rem; background: white; border-radius: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <canvas id="${chartId}" style="max-height: 300px;"></canvas>
    </div>`;
}

function parseChartConfig(content) {
    const config = {
        type: 'bar',
        title: 'Gráfico',
        labels: [],
        data: [],
        label: 'Dados'
    };
    
    const lines = content.trim().split('\n');
    lines.forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key === 'type') config.type = value;
        else if (key === 'title') config.title = value;
        else if (key === 'labels') config.labels = JSON.parse(value);
        else if (key === 'data') config.data = JSON.parse(value);
        else if (key === 'label') config.label = value;
    });
    
    return config;
}

function renderTable(content) {
    const config = parseTableConfig(content);
    
    let html = '<div class="table-container" style="margin: 1rem 0; overflow-x: auto;">';
    html += '<table style="width: 100%; border-collapse: collapse; background: white; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">';
    
    // Headers
    html += '<thead><tr>';
    config.headers.forEach(header => {
        html += `<th style="padding: 1rem; text-align: left; background: linear-gradient(135deg, #0077ff, #2f00ff); color: #000000; font-weight: 700; border-bottom: 3px solid #2f00ff;">${header}</th>`;
    });
    html += '</tr></thead>';
    
    // Rows
    html += '<tbody>';
    config.rows.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f0f8ff';
        html += `<tr style="background: ${bgColor};">`;
        row.forEach(cell => {
            html += `<td style="padding: 0.875rem 1rem; border-bottom: 1px solid #d9f0ff; color: #1a1a1a; font-weight: 500;">${cell}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    
    html += '</table></div>';
    return html;
}

function parseTableConfig(content) {
    const config = {
        headers: [],
        rows: []
    };
    
    const lines = content.trim().split('\n');
    lines.forEach(line => {
        if (line.includes('headers:')) {
            const value = line.substring(line.indexOf('['));
            config.headers = JSON.parse(value);
        } else if (line.includes('rows:')) {
            const startIndex = content.indexOf('[', content.indexOf('rows:'));
            const endIndex = content.lastIndexOf(']') + 1;
            const value = content.substring(startIndex, endIndex);
            config.rows = JSON.parse(value);
        }
    });
    
    return config;
}

function renderCalc(content) {
    const lines = content.trim().split('\n');
    let html = '<div class="calc-container" style="margin: 1rem 0; padding: 1.5rem; background: #ffffff; border-radius: 0.75rem; border: 2px solid #0077ff; box-shadow: 0 2px 12px rgba(16, 14, 124, 0.25);">';
    
    lines.forEach((line, index) => {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key === 'título') {
            html += `<h4 style="margin: 0 0 1rem 0; color: #000000; font-size: 1.25rem; font-weight: 700; padding-bottom: 0.75rem; border-bottom: 2px solid #0077ff;">${value}</h4>`;
        } else if (key === 'total') {
            html += `<div style="margin-top: 1rem; padding: 1rem; border-top: 2px solid #0077ff; font-weight: 700; font-size: 1.35rem; color: #000000; background: linear-gradient(135deg, #0077ff, #2f00ff); border-radius: 0.5rem; box-shadow: 0 2px 8px rgba(16, 14, 124, 0.3);">${value}</div>`;
        } else {
            html += `<div style="padding: 0.75rem 0; color: #000000; display: flex; justify-content: space-between; font-weight: 500; border-bottom: 1px solid #d9f0ff;"><span style="color: #1a1a1a;">${value.split('=')[0]}</span><span style="font-weight: 700; color: #000000; font-size: 1.05rem;">${value.split('=')[1]}</span></div>`;
        }
    });
    
    html += '</div>';
    return html;
}

function renderMermaid(content, type) {
    const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const code = content.trim();
    const container = `<div class="mermaid-container" style="margin: 1rem 0; padding: 1rem; background: #ffffff; border-radius: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06);"><div id="${id}">Carregando diagrama...</div></div>`;

    setTimeout(() => {
        try {
            if (window.mermaid) {
                if (mermaid.mermaidAPI && mermaid.mermaidAPI.render) {
                    mermaid.mermaidAPI.render(id, code, (svgCode) => {
                        const el = document.getElementById(id);
                        if (el) el.innerHTML = svgCode;
                    });
                } else if (mermaid.render) {
                    const svg = mermaid.render(id, code);
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = svg;
                } else {
                    mermaid.initialize({ startOnLoad: false });
                    const el = document.getElementById(id);
                    if (el) {
                        el.textContent = code;
                        mermaid.init(undefined, el);
                    }
                }
            } else {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<pre style="white-space:pre-wrap;">' + escapeHtml(code) + '</pre>';
            }
        } catch (e) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<pre style="white-space:pre-wrap;">' + escapeHtml(code) + '</pre>';
        }
    }, 50);

    return container;
}

// ================================
// Send Message
// ================================

function sendMessage(event) {
    console.log('[DEBUG] sendMessage invoked', { eventType: event && event.type ? event.type : typeof event });
    try {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
    } catch (e) {
        // ignore if event is not present or preventDefault fails
    }
    
    // Ensure we have the elements
    if (!messageInput) messageInput = document.getElementById('messageInput');
    if (!sendBtn) sendBtn = document.getElementById('sendBtn');
    if (!chatMessages) chatMessages = document.getElementById('chatMessages');
    
    if (!messageInput || !sendBtn || !chatMessages) {
        console.error('[ERROR] Chat elements not found');
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    
    // Add to conversation history
    conversationHistory.push({
        role: 'user',
        content: message
    });
    
    // Clear input
    messageInput.value = '';
    sendBtn.disabled = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    // Call Groq API
    callGroqAPI(message).then(response => {
        hideTypingIndicator();
        
        // Add to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: response
        });
        
        // Add AI message with parsed content
        addMessage(response, 'ai');
        sendBtn.disabled = false;
        messageInput.focus();
    }).catch(error => {
        hideTypingIndicator();
        console.error('[ERROR] sendMessage:', error);
        addMessage('Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.', 'ai');
        sendBtn.disabled = false;
        messageInput.focus();
    });
}


// Add message to chat
function addMessage(text, sender) {
    if (!chatMessages) chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    if (sender === 'ai') {
        const parsedContent = parseAndRenderMessage(text);
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" fill="url(#avatarGrad)"/>
                </svg>
            </div>
            <div class="message-content">
                ${parsedContent}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(text)}</p>
            </div>
            <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" fill="#6b7280"/>
                </svg>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    if (!chatMessages) chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" fill="url(#avatarGrad)"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// ================================
// Quick Messages & Navigation
// ================================

// Send quick message
function sendQuickMessage(message) {
    if (isChatPage) {
        if (!messageInput) messageInput = document.getElementById('messageInput');
        if (!chatMessages) chatMessages = document.getElementById('chatMessages');
        if (messageInput) {
            // Remove welcome screen if it exists
            const welcomeScreen = document.querySelector('.welcome-screen');
            if (welcomeScreen) {
                welcomeScreen.remove();
            }
            
            messageInput.value = message;
            // Prefer submitting the form so the submit handler runs and prevents default navigation
            const form = document.querySelector('.chat-input-form');
            if (form) {
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            } else {
                // Fallback: call sendMessage directly with a safe event
                sendMessage(new Event('submit'));
            }
        }
    }
}

// Scroll to chat section (legacy for index page)
function scrollToChat() {
    window.location.href = 'chat.html';
}

// New Chat - Clear conversation and start fresh
function newChat() {
    if (confirm('Deseja iniciar uma nova conversa? A conversa atual será perdida.')) {
        clearChat();
    }
}

// Clear Chat - Reset conversation
function clearChat() {
    // Reset conversation history to just the system message
    conversationHistory = [conversationHistory[0]];
    
    // Clear chat messages and show welcome screen
    if (!chatMessages) chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="url(#welcomeGrad)" stroke-width="2"/>
                        <path d="M32 16L24 24H28V36H36V24H40L32 16Z" fill="url(#welcomeGrad)"/>
                        <path d="M22 40H42V44H22V40Z" fill="url(#welcomeGrad)"/>
                        <defs>
                            <linearGradient id="welcomeGrad" x1="0" y1="0" x2="64" y2="64">
                                <stop offset="0%" stop-color="#0077ff"/>
                                <stop offset="100%" stop-color="#2f00ff"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h2>Bem-vindo ao FinanxIA Premium</h2>
                <p>Sua assistente de contabilidade com IA está pronta para ajudar!</p>
                
                <div class="quick-suggestions">
                    <button class="suggestion-card" onclick="sendQuickMessage('Crie um gráfico de impostos mensais para uma empresa do Simples Nacional')">
                        <div class="suggestion-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="3" width="4" height="14" stroke="#0077ff" stroke-width="1.5" fill="none"/>
                                <rect x="10" y="7" width="4" height="10" stroke="#0077ff" stroke-width="1.5" fill="none"/>
                                <rect x="17" y="5" width="4" height="12" stroke="#0077ff" stroke-width="1.5" fill="none"/>
                                <line x1="2" y1="19" x2="22" y2="19" stroke="#0077ff" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <div class="suggestion-content">
                            <div class="suggestion-title">Gerar Gráfico</div>
                            <div class="suggestion-desc">Visualização de dados contábeis</div>
                        </div>
                    </button>
                    
                    <button class="suggestion-card" onclick="sendQuickMessage('Crie uma tabela com os principais prazos de declarações de 2026')">
                        <div class="suggestion-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#0077ff" stroke-width="1.5" fill="none"/>
                                <line x1="3" y1="9" x2="21" y2="9" stroke="#0077ff" stroke-width="1.5"/>
                                <line x1="9" y1="4" x2="9" y2="22" stroke="#0077ff" stroke-width="1.5"/>
                                <line x1="15" y1="4" x2="15" y2="22" stroke="#0077ff" stroke-width="1.5"/>
                            </svg>
                        </div>
                        <div class="suggestion-content">
                            <div class="suggestion-title">Prazos e Obrigações</div>
                            <div class="suggestion-desc">Calendário tributário 2026</div>
                        </div>
                    </button>
                    
                    <button class="suggestion-card" onclick="sendQuickMessage('Análise comparativa entre Simples Nacional e Lucro Presumido')">
                        <div class="suggestion-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 17L9 11L13 15L21 7" stroke="#0077ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M16 7H21V12" stroke="#0077ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="suggestion-content">
                            <div class="suggestion-title">Análise Comparativa</div>
                            <div class="suggestion-desc">Compare regimes tributários</div>
                        </div>
                    </button>
                    
                    <button class="suggestion-card" onclick="sendQuickMessage('Calcule o INSS e FGTS para um salário de R$ 5.000')">
                        <div class="suggestion-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="9" stroke="#0077ff" stroke-width="1.5" fill="none"/>
                                <path d="M12 6V8M12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12C13.6569 12 15 13.3431 15 15C15 16.6569 13.6569 18 12 18M12 18V20M12 18C10.3431 18 9 16.6569 9 15" stroke="#0077ff" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <div class="suggestion-content">
                            <div class="suggestion-title">Calcular Encargos</div>
                            <div class="suggestion-desc">INSS, FGTS e outros encargos</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }
}

// Enable/disable send button and handle submit reliably
if (isChatPage) {
    const initChatHandlers = () => {
        const messageInputEl = document.getElementById('messageInput');
        const sendBtnEl = document.getElementById('sendBtn');

        if (messageInputEl) {
            // enable/disable send button
            messageInputEl.addEventListener('input', () => {
                if (sendBtnEl) sendBtnEl.disabled = !messageInputEl.value.trim();
            });

            // Handle Enter key
            messageInputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (messageInputEl.value.trim()) {
                        messageInput = messageInputEl;
                        sendBtn = sendBtnEl;
                        sendMessage(e);
                    }
                }
            });
        }

        // Ensure form submit is handled robustly (prevents full-page reload)
        const formEl = document.querySelector('.chat-input-form');
        if (formEl) {
            // remove any existing submit handlers to avoid duplicates
            formEl.addEventListener('submit', (ev) => {
                try { ev.preventDefault(); } catch (err) {}
                // ensure our elements are set
                if (!messageInput) messageInput = document.getElementById('messageInput');
                if (!sendBtn) sendBtn = document.getElementById('sendBtn');
                sendMessage(ev);
            });
        }
        // Click handler for send button (for type=button)
        if (sendBtnEl) {
            sendBtnEl.addEventListener('click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                // ensure our elements
                if (!messageInput) messageInput = document.getElementById('messageInput');
                if (!sendBtn) sendBtn = document.getElementById('sendBtn');
                sendMessage(ev);
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatHandlers);
    } else {
        // Document already loaded - initialize immediately
        initChatHandlers();
    }
}

// ================================
// Smooth Scroll for Navigation
// ================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ================================
// Navbar Scroll Effect
// ================================

let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (navbar) {
        if (currentScroll <= 0) {
            navbar.style.boxShadow = 'none';
        } else {
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
        }
    }
    
    lastScroll = currentScroll;
});

// ================================
// Intersection Observer for Animations
// ================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature cards
document.querySelectorAll('.feature-card, .step, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ================================
// Initialize tooltips and interactions
// ================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('FinanxIA - Sistema de IA para Contabilidade carregado com sucesso! 🚀');

    if (window.mermaid) {
        try {
            mermaid.initialize({ startOnLoad: false });
        } catch (e) {
            console.warn('Mermaid initialization failed:', e);
        }
    }
    
    // Add animation to hero elements (only on index page)
    if (!isChatPage) {
        const heroElements = document.querySelectorAll('.hero-badge, .hero-title, .hero-description, .hero-actions, .hero-stats');
        heroElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
    
    // Focus on chat input when page loads (only on chat page)
    if (isChatPage) {
        setTimeout(() => {
            if (!messageInput) messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.focus();
            }
        }, 500);
    }
});

// ================================
// Pricing Card Interactions (only on index page)
// ================================

if (!isChatPage) {
    const pricingCards = document.querySelectorAll('.pricing-card');
    if (pricingCards.length > 0) {
        pricingCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-8px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
            });
        });
    }
}

// ================================
// Clear Chat Button
// ================================

if (isChatPage) {
    const clearBtn = document.querySelector('.icon-btn[title="Limpar conversa"]');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Deseja limpar toda a conversa?')) {
                // Reset conversation history
                conversationHistory = [conversationHistory[0]]; // Keep only system message
                
                if (!chatMessages) chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = `
                    <div class="message ai-message">
                        <div class="message-avatar">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="8" fill="url(#avatarGrad)"/>
                            </svg>
                        </div>
                        <div class="message-content">
                            <p>Olá! 👋 Sou sua assistente de contabilidade com IA. Como posso ajudá-lo hoje?</p>
                            <div class="quick-actions">
                                <button class="quick-action" onclick="sendQuickMessage('Crie um gráfico de impostos mensais para uma empresa do Simples Nacional')">
                                    📊 Gerar Gráfico
                                </button>
                                <button class="quick-action" onclick="sendQuickMessage('Crie uma tabela com os principais prazos de declarações de 2026')">
                                    📅 Gerar Tabela
                                </button>
                                <button class="quick-action" onclick="sendQuickMessage('Análise comparativa entre Simples Nacional e Lucro Presumido')">
                                    📈 Análise Comparativa
                                </button>
                                <button class="quick-action" onclick="sendQuickMessage('Calcule o INSS e FGTS para um salário de R$ 5.000')">
                                    💰 Calcular Encargos
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                }
            }
        });
    }
}

// ================================
// Copy Code Functionality (if needed for future)
// ================================

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show success message
        const toast = document.createElement('div');
        toast.textContent = 'Copiado para a área de transferência!';
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    });
}
