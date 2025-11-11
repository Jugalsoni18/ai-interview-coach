// DOM Elements
const header = document.querySelector('.header');
const navbar = document.querySelector('.navbar');
const heroSection = document.querySelector('.hero');
const featureCards = document.querySelectorAll('.feature-card');
const testimonialCards = document.querySelectorAll('.testimonial-card');
let searchForm = document.querySelector('.search-form');
const searchInput = document.querySelector('.search-input');
let menuBtn = document.querySelector('#menu-btn');
let navLinks = document.querySelector('#nav-links');

// Parallax Effect
const parallaxElements = document.querySelectorAll('.hero-visual, .feature-card, .testimonial-card');

// Initialize Intersection Observer for animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            navLinks.classList.remove('active');
            menuBtn.querySelector('i').classList.add('ri-menu-line');
            menuBtn.querySelector('i').classList.remove('ri-close-line');
        }
    });
});

// Navbar Scroll Effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        header.classList.remove('scroll-up');
        return;
    }
    
    if (currentScroll > lastScroll && !header.classList.contains('scroll-down')) {
        // Scroll Down
        header.classList.remove('scroll-up');
        header.classList.add('scroll-down');
    } else if (currentScroll < lastScroll && header.classList.contains('scroll-down')) {
        // Scroll Up
        header.classList.remove('scroll-down');
        header.classList.add('scroll-up');
    }
    lastScroll = currentScroll;
});

// Parallax Effect
window.addEventListener('scroll', () => {
    const scrollPosition = window.pageYOffset;
    
    parallaxElements.forEach(element => {
        const speed = element.dataset.speed || 0.5;
        const yPos = -(scrollPosition * speed);
        element.style.transform = `translateY(${yPos}px)`;
    });
});

// Feature Cards 3D Effect
featureCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    });
});

// Testimonial Carousel
let currentTestimonial = 0;
const testimonials = document.querySelectorAll('.testimonial-card');

function showTestimonial(index) {
    testimonials.forEach((testimonial, i) => {
        testimonial.style.display = i === index ? 'block' : 'none';
        testimonial.style.opacity = i === index ? '1' : '0';
        testimonial.style.transform = i === index ? 'translateY(0)' : 'translateY(20px)';
    });
}

function nextTestimonial() {
    currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    showTestimonial(currentTestimonial);
}

// Auto-rotate testimonials every 5 seconds
setInterval(nextTestimonial, 5000);

// Search Functionality
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        // Implement search functionality here
        console.log('Searching for:', searchTerm);
    }
});

// Mobile Menu Toggle
menuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    menuBtn.querySelector('i').classList.toggle('ri-menu-line');
    menuBtn.querySelector('i').classList.toggle('ri-close-line');
});

// Intersection Observer for Animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        }
    });
}, observerOptions);

// Observe elements for animations
document.querySelectorAll('.feature-card, .testimonial-card, .stat-card').forEach(element => {
    observer.observe(element);
});

// Initialize animations
document.addEventListener('DOMContentLoaded', () => {
    // Add initial animation classes
    document.querySelectorAll('.hero-title, .hero-description, .hero-cta').forEach(element => {
        element.classList.add('animate');
    });
    
    // Show first testimonial
    showTestimonial(0);
});

// Add smooth loading for images
document.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', () => {
        img.classList.add('loaded');
    });
    
    if (img.complete) {
        img.classList.add('loaded');
    }
});

// Initialize ScrollReveal
ScrollReveal().reveal('.header__container', {
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true
});

ScrollReveal().reveal('.steps__card', {
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true,
    origin: 'bottom',
    interval: 200
});

ScrollReveal().reveal('.explore__card', {
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true,
    origin: 'bottom',
    interval: 200
});

ScrollReveal().reveal('.job__card', {
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true,
    origin: 'bottom',
    interval: 200
});

ScrollReveal().reveal('.offer__card', {
    distance: '60px',
    duration: 2500,
    delay: 400,
    reset: true,
    origin: 'bottom',
    interval: 200
});

// Initialize Swiper
const swiper = new Swiper('.swiper', {
    slidesPerView: 1,
    spaceBetween: 30,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        640: {
            slidesPerView: 2,
        },
        1024: {
            slidesPerView: 3,
        },
    },
});

// DOM Elements
const searchResults = document.querySelector('.job__grid');
const aiFilterPrompt = document.querySelector('.ai__filter__prompt');
const searchResultsLabel = document.querySelector('.search__results__label');
const aiModal = document.querySelector('.ai__modal');
const aiModalClose = document.querySelector('.ai__modal__close');

// Mobile menu toggle
menuBtn.addEventListener('click', () => {
    const isVisible = navLinks.style.display === 'flex';
    navLinks.style.display = isVisible ? 'none' : 'flex';
});

// AI Job Search Functionality
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    
    if (!query) return;
    
    try {
        showLoading();
        const response = await fetch('http://localhost:5000/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            displaySearchResults(data.jobs, query);
            updateAIFilterPrompt(data.analysis);
        } else {
            throw new Error(data.error || 'Search failed');
        }
    } catch (error) {
        console.error('Error searching:', error);
        showError('Failed to search jobs. Please try again.');
    } finally {
        hideLoading();
    }
});

// Display search results
function displaySearchResults(jobs, query) {
    searchResultsLabel.textContent = `Showing results for "${query}"`;
    searchResultsLabel.style.display = 'block';
    
    searchResults.innerHTML = jobs.map(job => `
        <div class="job__card">
            <div class="job__card__header">
                <img src="${job.company.toLowerCase()}.png" alt="${job.company}" />
                <div>
                    <h5>${job.company}</h5>
                    <h6>${job.location}</h6>
                </div>
            </div>
            <h4>${job.title}</h4>
            <p>${job.description}</p>
            <div class="job__card__footer">
                <span>${job.positions} Positions</span>
                <span>${job.type}</span>
                <span>${job.salary}</span>
            </div>
            <div class="ai__learn__more" onclick="showJobAnalysis(${job.id})">
                <i class="ri-ai-generate"></i>
            </div>
        </div>
    `).join('');
}

// Update AI filter prompt
function updateAIFilterPrompt(analysis) {
    try {
        const parsedAnalysis = JSON.parse(analysis);
        const jobTitle = parsedAnalysis.job_title || 'Software Engineer';
        const location = parsedAnalysis.location || 'USA';
        
        aiFilterPrompt.innerHTML = `Did you mean <span>${jobTitle}</span> in <span>${location}</span>?`;
        aiFilterPrompt.style.display = 'block';
    } catch (error) {
        console.error('Error parsing AI analysis:', error);
        aiFilterPrompt.style.display = 'none';
    }
}

// Show job analysis modal
async function showJobAnalysis(jobId) {
    try {
        showLoading();
        const response = await fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayJobAnalysis(data.analysis);
            aiModal.style.display = 'flex';
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Error analyzing job:', error);
        showError('Failed to analyze job. Please try again.');
    } finally {
        hideLoading();
    }
}

// Display job analysis in modal
function displayJobAnalysis(analysis) {
    try {
        const parsedAnalysis = JSON.parse(analysis);
        const modalContent = document.querySelector('.ai__modal__content');
        
        modalContent.innerHTML = `
            <i class="ri-close-line ai__modal__close"></i>
            <h3 class="ai__modal__title">AI-Powered Job Insights</h3>
            <p class="ai__modal__summary">
                Based on your profile and the job requirements, here's what you need to know about this position...
            </p>
            <div class="ai__modal__insights">
                <h4>Key Requirements</h4>
                <ul>
                    ${parsedAnalysis.key_requirements.map(req => `<li>${req}</li>`).join('')}
                </ul>
            </div>
            <div class="ai__modal__insights">
                <h4>Company Culture</h4>
                <ul>
                    ${parsedAnalysis.company_culture.map(culture => `<li>${culture}</li>`).join('')}
                </ul>
            </div>
            <div class="ai__modal__insights">
                <h4>Career Growth</h4>
                <ul>
                    ${parsedAnalysis.career_growth.map(growth => `<li>${growth}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Add close button event listener
        const closeBtn = modalContent.querySelector('.ai__modal__close');
        closeBtn.addEventListener('click', () => {
            aiModal.style.display = 'none';
        });
    } catch (error) {
        console.error('Error displaying analysis:', error);
        showError('Failed to display job analysis. Please try again.');
    }
}

// Loading and error states
function showLoading() {
    searchResults.innerHTML = '<div class="loading">Searching jobs...</div>';
}

function hideLoading() {
    const loading = searchResults.querySelector('.loading');
    if (loading) loading.remove();
}

function showError(message) {
    searchResults.innerHTML = `<div class="error">${message}</div>`;
} 



//-----AI BOT------------------------------------------------------//

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatLauncher = document.getElementById('chatLauncher');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    // Chat State
    let isFirstInteraction = true;

    // Toggle Chat Visibility
    const toggleChat = () => {
        chatContainer.classList.toggle('visible');
        if (chatContainer.classList.contains('visible') && isFirstInteraction) {
            showWelcomeMessage();
            isFirstInteraction = false;
        }
    };

    // Show Welcome Message
    const showWelcomeMessage = () => {
        addBotMessage(`
            <div class="welcome-message">
                <p>👋 Welcome to JobBuddy AI!</p>
                <p>I'm here to help you with:</p>
                <ul>
                    <li>• Job search strategies</li>
                    <li>• Interview preparation</li>
                    <li>• Resume optimization</li>
                    <li>• Career guidance</li>
                </ul>
                <p>How can I assist you today?</p>
            </div>
        `);
    };

    // Add Message to Chat
    const addMessage = (content, isUser = false) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        messageDiv.innerHTML = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Add Bot Message
    const addBotMessage = (content) => {
        addMessage(content, false);
    };

    // Show Typing Indicator
    const showTyping = () => {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Remove Typing Indicator
    const removeTyping = () => {
        const typing = document.querySelector('.typing-indicator');
        if (typing) typing.remove();
    };

    // Handle User Input
    const handleUserInput = async () => {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, true);
        userInput.value = '';
        
        // Show typing indicator
        showTyping();

        // Simulate bot response (replace with actual API call)
        setTimeout(() => {
            removeTyping();
            addBotMessage(`
                <div class="bot-response">
                    <p>Thanks for your question! Here's what I can suggest:</p>
                    <ol>
                        <li>Review your resume keywords</li>
                        <li>Practice common interview questions</li>
                        <li>Research the company culture</li>
                    </ol>
                    <p>Would you like me to elaborate on any of these points?</p>
                </div>
            `);
        }, 1500);
    };

    // Event Listeners
    chatLauncher.addEventListener('click', (e) => {
        e.preventDefault();
        toggleChat();
    });

    closeChat.addEventListener('click', (e) => {
        e.preventDefault();
        toggleChat();
    });

    sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleUserInput();
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    });
});

// Close Chat
const closeChatInterface = () => {
    chatContainer.classList.remove('visible');
};

// Event Listeners
closeChat.addEventListener('click', closeChatInterface);






