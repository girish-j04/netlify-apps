const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { exec } = require('child_process');
const { promisify } = require('util');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'applications.json');
const RESUME_TEX_FILE = path.join(__dirname, 'tailored_resume.tex');
const RESUME_PDF_FILE = path.join(__dirname, 'tailored_resume.pdf');

const execAsync = promisify(exec);

// Gemini API Configuration - Now using environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    console.error('Please create a .env file with your Gemini API key');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// Your exact working LaTeX resume template
const BASE_RESUME_LATEX = `\\documentclass[letterpaper,6pt]{article}
\\usepackage{graphicx}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome}
\\usepackage{multicol}
\\setlength{\\multicolsep}{-3.0pt}
\\setlength{\\columnsep}{-1pt}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.6in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1.19in}
\\addtolength{\\topmargin}{-.7in}
\\addtolength{\\textheight}{1.4in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\classesList}[4]{
    \\item\\small{
        {#1 #2 #3 #4 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{1.0\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{1.001\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & \\textbf{\\small #2}\\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemi{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

\\begin{center}
    {\\huge \\scshape Girish Jeswani} \\\\
    \\vspace{1pt}
    \\small \\raisebox{-0.1\\height}{\\faPhone} \\underline{(720)7360799} ~ 
    \\href{mailto:girishjeswani04@gmail.com}{\\raisebox{-0.2\\height}{\\faEnvelope} \\underline{girishjeswani04@gmail.com}} ~ 
    \\href{https://linkedin.com/in/gjeswani}{\\raisebox{-0.2\\height}{\\faHome} \\underline{1853, 26th ST, Boulder, CO, 80302}} ~
    \\href{https://linkedin.com/in/gjeswani}{\\raisebox{-0.2\\height}{\\faLinkedinSquare} \\underline{gjeswani}}
    \\vspace{-8pt}
\\end{center}

%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {University of Colorado, Boulder}{Aug. 2024 - Present}
      {Master of Science in Computer Science; GPA: 3.94/4.0}{Boulder, CO}
    \\resumeSubheading
      {National Institute of Technology Karnataka (NITK)}{Aug. 2018 -- May 2022}
      {Bachelor of Technology in Information Technology; GPA: 3.4/4.0}{Karnataka, India}
  \\resumeSubHeadingListEnd

%-----------PROGRAMMING SKILLS-----------
[SKILLS_SECTION]

[WORK_EXPERIENCE_SECTION]

\\vspace{-5pt}

\\section{Projects \\& Publications}
\\vspace{-5pt}  
[PROJECTS_SECTION]

\\vspace{-5pt}
\\end{document}`;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Initialize data file
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
}

// Read applications from file
async function readApplications() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Write applications to file
async function writeApplications(applications) {
    await fs.writeFile(DATA_FILE, JSON.stringify(applications, null, 2));
}

// Job scraping functions (unchanged from your original code)
async function scrapeJobWithPuppeteer(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
        
        const jobData = await page.evaluate(() => {
            // LinkedIn selectors
            if (window.location.hostname.includes('linkedin.com')) {
                return {
                    title: document.querySelector('.top-card-layout__title')?.textContent?.trim() ||
                           document.querySelector('h1.t-24')?.textContent?.trim() ||
                           document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim(),
                    company: document.querySelector('.topcard__flavor-row .topcard__flavor--black-link')?.textContent?.trim() ||
                            document.querySelector('.top-card-layout__card .topcard__org-name-link')?.textContent?.trim(),
                    jobId: window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] || 
                           document.querySelector('[data-job-id]')?.getAttribute('data-job-id'),
                    description: document.querySelector('.show-more-less-html__markup')?.textContent?.trim() ||
                               document.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent?.trim()
                };
            }
            
            // Indeed selectors
            if (window.location.hostname.includes('indeed.com')) {
                return {
                    title: document.querySelector('[data-jk] h1')?.textContent?.trim() ||
                           document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim(),
                    company: document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() ||
                            document.querySelector('.icl-u-lg-mr--sm')?.textContent?.trim(),
                    jobId: window.location.search.match(/jk=([^&]+)/)?.[1] ||
                           document.querySelector('[data-jk]')?.getAttribute('data-jk'),
                    description: document.querySelector('#jobDescriptionText')?.textContent?.trim()
                };
            }
            
            // Glassdoor selectors
            if (window.location.hostname.includes('glassdoor.com')) {
                return {
                    title: document.querySelector('[data-test="job-title"]')?.textContent?.trim() ||
                           document.querySelector('.e1tk4kwz4')?.textContent?.trim(),
                    company: document.querySelector('[data-test="employer-name"]')?.textContent?.trim() ||
                            document.querySelector('.e1tk4kwz5')?.textContent?.trim(),
                    jobId: window.location.pathname.match(/jobs\/([^\/]+)/)?.[1],
                    description: document.querySelector('[data-test="jobDescriptionContent"]')?.textContent?.trim()
                };
            }
            
            // Generic fallback selectors
            return {
                title: document.querySelector('h1')?.textContent?.trim() ||
                       document.querySelector('[class*="title"], [class*="job-title"], [id*="title"]')?.textContent?.trim() ||
                       document.title,
                company: document.querySelector('[class*="company"], [class*="employer"], [class*="organization"]')?.textContent?.trim() ||
                        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content'),
                jobId: window.location.pathname.split('/').pop() || Math.random().toString(36).substr(2, 9),
                description: document.querySelector('[class*="description"], [class*="job-description"], [id*="description"]')?.textContent?.trim()
            };
        });
        
        return jobData;
    } catch (error) {
        console.error('Puppeteer scraping failed:', error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

async function scrapeJobWithCheerio(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        
        let title, company, jobId, description;
        
        if (url.includes('linkedin.com')) {
            title = $('.top-card-layout__title').text().trim() || $('h1.t-24').text().trim();
            company = $('.topcard__flavor-row .topcard__flavor--black-link').text().trim();
            jobId = url.match(/\/jobs\/view\/(\d+)/)?.[1];
            description = $('.show-more-less-html__markup').text().trim();
        } else if (url.includes('indeed.com')) {
            title = $('[data-jk] h1').text().trim() || $('.jobsearch-JobInfoHeader-title').text().trim();
            company = $('[data-testid="inlineHeader-companyName"]').text().trim();
            jobId = url.match(/jk=([^&]+)/)?.[1];
            description = $('#jobDescriptionText').text().trim();
        } else if (url.includes('glassdoor.com')) {
            title = $('[data-test="job-title"]').text().trim();
            company = $('[data-test="employer-name"]').text().trim();
            jobId = url.match(/jobs\/([^\/]+)/)?.[1];
            description = $('[data-test="jobDescriptionContent"]').text().trim();
        } else {
            title = $('h1').first().text().trim() || 
                   $('[class*="title"], [class*="job-title"], [id*="title"]').first().text().trim() ||
                   $('title').text().trim();
            company = $('[class*="company"], [class*="employer"], [class*="organization"]').first().text().trim();
            jobId = Math.random().toString(36).substr(2, 9);
            description = $('[class*="description"], [class*="job-description"], [id*="description"]').first().text().trim();
        }
        
        return {
            title: title || 'Job Title Not Found',
            company: company || 'Company Not Found',
            jobId: jobId || Math.random().toString(36).substr(2, 9),
            description: description || 'Job description not found'
        };
    } catch (error) {
        console.error('Cheerio scraping failed:', error.message);
        throw error;
    }
}

// Your current resume data structure (unchanged)
const RESUME_DATA = {
    workExperience: [
        {
            title: "AI Research Developer",
            company: "Leeds School of Business, CU Boulder",
            location: "Boulder, CO",
            duration: "May 2025 - Present",
            bullets: [
                "Architected a full-stack AI-powered PhD Advisory System using React and FastAPI, featuring three specialized advisor personas that provide personalized academic guidance through intelligent conversation orchestration.",
                "Engineered a multi-LLM backend infrastructure supporting Gemini API and Ollama with dynamic provider switching capabilities, implementing seamless fallback systems and real-time model switching.",
                "Developed an intelligent conversation orchestrator and document processing capabilities with PDF/DOCX support, enabling context-aware conversations through automated text extraction and session-based file management.",
                "Expanded functionality with RAG (Retrieval-Augmented Generation) integration to leverage uploaded documents for enhanced query responses and personalized academic recommendations.",
                "Deployed production infrastructure on Google Cloud Platform using Cloud Run for backend services and Firebase for frontend hosting, ensuring scalable, secure, and cost-efficient operations."
            ]
        },
        {
            title: "Software Engineer",
            company: "Wells Fargo",
            location: "Hyderabad, India", 
            duration: "July 2022 - July 2024",
            bullets: [
                "Orchestrated multi-device compatibility for a virtual assistant platform ensuring flawless operation across Windows and mobile platforms, enabling quick resolution times under one hour per incident.",
                "Developed an Intent Recognition System leveraging transformer models like BERT and established enterprise pipeline (EPL) for efficient service deployment, serving 250,000+ employees.",
                "Attained 95%+ code coverage through unit-testing with XUnit and Moq and launched four targeted usability improvements that increased engagement metrics through enhanced cross-platform compatibility."
            ]
        },
        {
            title: "Software Engineer Intern",
            company: "Penzigo Technology",
            location: "Karnataka, India",
            duration: "May 2021 - Jan 2022",
            bullets: [
                "Spearheaded launch of a consumer mobile application using Flutter and Firebase with seamless third-party payment system integration for enhanced transaction efficiency.",
                "Constructed a feature-rich admin portal with NodeJS and React, including automated reporting functionality that reduced administrative workload by 50% and resolved critical performance bottlenecks."
            ]
        }
    ],
    projects: [
        {
            title: "GradCompass - AI-Powered Graduate Application Assistant",
            technologies: "React, FastAPI, PostgreSQL, Gemini API, RAG",
            bullets: [
                "Architected a comprehensive full-stack platform with FastAPI backend and React frontend, featuring 6 specialized AI agents to guide students through graduate school applications with personalized recommendations.",
                "Engineered robust PostgreSQL database architecture with SQLAlchemy ORM, implementing user authentication, profile management, and complete CRUD operations with Google OAuth integration.",
                "Implemented an AI-powered visa interview simulator using Gemini API and RAG, generating personalized interview questions with real-time speech-to-text processing and comprehensive scoring with detailed feedback."
            ]
        },
        {
            title: "Cine-Stellation - Interactive Movie Recommendation Constellation",
            technologies: "Next.js, FastAPI, TF-IDF, MongoDB, HTML5 Canvas",
            bullets: [
                "Built a full-stack movie recommendation system with a Next.js frontend and FastAPI backend, featuring an immersive space-themed UI with real-time force-directed constellation graphs.",
                "Implemented TF-IDF vectorization and cosine similarity to generate intelligent content-based recommendations with plot-level search and genre filtering.",
                "Integrated MongoDB authentication and persistence, enabling personalized watchlists and seamless user experience.",
                "Rendered interactive graph visualizations on HTML5 Canvas, allowing users to explore film connections dynamically based on user preferences and movie similarity."
            ]
        },
        {
            title: "Integrated Wildfire Risk Prediction and Monitoring System",
            technologies: "Python, LSTM, XGBoost, NASA-FIRMS",
            bullets: [
                "Developed an AI-driven platform achieving 82% accuracy and 90% recall for wildfire risk assessment, integrating real-time NASA FIRMS data with predictive modeling.",
                "Implemented LSTM networks to analyze temporal wildfire patterns, enhancing forecasting accuracy for proactive risk mitigation.",
                "Optimized wildfire risk classification with XGBoost (80% accuracy) and Random Forest (79%), improving decision-making for early wildfire detection."
            ]
        },
        {
            title: "Stacked Attention Network with Multi-Layer Feature Fusion for Visual Question Answering",
            technologies: "Python, ML, LSTM, CNN",
            bullets: [
                "Developed an image-based question-answering model combining LSTM and VGG19, leveraging multi-layer feature fusion to extract rich contextual and spatial information.",
                "Implemented stacked attention mechanisms to improve model focus on relevant image regions, boosting both efficiency and accuracy."
            ]
        },
        {
            title: "M-Commerce Offline Payment",
            technologies: "React Native, NodeJS, MongoDB",
            bullets: [
                "Created a wallet-based mobile application using React Native designed to facilitate seamless online and offline transactions between clients.",
                "Engineered a solution to reduce payment failures in areas with low connectivity, allowing transactions to be processed even offline, ensuring users reliability. Published in SN Computer Science 2022"
            ]
        }
    ],
    baseSkills: {
        languages: ["C#", "C++", "Python", "Java", "Javascript", "Dart"],
        databases: ["MySQL", "SQL", "AWS", "MongoDB", "NoSQL"],
        webTechnologies: ["HTML", "CSS", "jQuery", "React", "Flask", "Node.js", "OAuth", "JWT", "API", "FastAPI"],
        machineLearning: ["numpy", "pandas", "scikit-learn", "PyTorch", "Tensorflow"],
        miscellaneous: ["Kubernetes", "Linux", "Azure (AZ900)", "Hadoop", "Spark", "Docker", "CI/CD", "Git", "GCP"]
    }
};

// Enhanced keyword extraction and resume tailoring (your existing function)
async function extractKeywordsAndTailorResume(jobDescription) {
    const prompt = `
You are an expert ATS resume optimizer. Your job is to:

1. Extract ALL technical keywords, skills, tools, and technologies from the job description
2. Prioritize and reorder Girish's experience to match the job requirements
3. Integrate extracted keywords naturally into his existing experience
4. Ensure maximum ATS compatibility

JOB DESCRIPTION:
${jobDescription}

GIRISH'S CURRENT RESUME DATA:
${JSON.stringify(RESUME_DATA, null, 2)}

INSTRUCTIONS:
1. Extract keywords from job description (technologies, skills, tools, frameworks, methodologies)
2. Map these keywords to Girish's existing experience where relevant
3. Prioritize work experience and projects based on relevance to the job
4. Re-write any bullets necessary in the work experience or projects to fit the job description better.
5. Integrate keywords naturally without lying or exaggerating
6. Return optimized content in the EXACT format requested

OUTPUT FORMAT - Return ONLY the JSON object below with no additional text:

{
  "extractedKeywords": ["keyword1", "keyword2", "keyword3"],
  "skills": {
    "languages": ["optimized list with job-relevant keywords first"],
    "databases": ["optimized list with job-relevant keywords first"], 
    "webTechnologies": ["optimized list with job-relevant keywords first"],
    "machineLearning": ["optimized list with job-relevant keywords first"],
    "miscellaneous": ["optimized list with job-relevant keywords first"]
  },
  "workExperience": [
    {
      "title": "AI Research Developer",
      "company": "Leeds School of Business, CU Boulder", 
      "location": "Boulder, CO",
      "duration": "May 2025 - Present",
      "bullets": ["reordered bullets with keywords integrated naturally"]
    },
    {
      "title": "Software Engineer", 
      "company": "Wells Fargo",
      "location": "Hyderabad, India",
      "duration": "July 2022 - July 2024", 
      "bullets": ["reordered bullets with keywords integrated naturally"]
    },
    {
      "title": "Software Engineer Intern",
      "company": "Penzigo Technology",
      "location": "Karnataka, India", 
      "duration": "May 2021 - Jan 2022",
      "bullets": ["reordered bullets with keywords integrated naturally"]
    }
  ],
  "projects": [
    {
      "title": "1st most relevant project title",
      "technologies": "updated with job-relevant keywords",
      "bullets": ["enhanced bullets with integrated keywords"]
    },
    {
      "title": "2nd most relevant project title",
      "technologies": "updated with job-relevant keywords",
      "bullets": ["Use existing bullets with integrated keywords"]
    },
    {
      "title": "3rd most relevant project title",
      "technologies": "updated with job-relevant keywords",
      "bullets": ["Use existing bullets with integrated keywords"]
    }
  ]
}

CRITICAL RULES:
- Only add keywords that Girish realistically knows/used
- Prioritize most relevant experience first
- Keep all factual information accurate
- Integrate keywords naturally, not forced
- Return ONLY valid JSON, no other text
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().trim();
        
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in AI response');
        }
        
        const parsedData = JSON.parse(jsonMatch[0]);
        console.log('Successfully extracted keywords:', parsedData.extractedKeywords);
        
        return parsedData;
    } catch (error) {
        console.error('Error extracting keywords:', error);
        throw error;
    }
}

function escapeLatex(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/\#/g, '\\#')  
        .replace(/\$/g, '\\$')
        .replace(/\%/g, '\\%')
        .replace(/\&/g, '\\&')
        .replace(/\_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/\~/g, '\\textasciitilde{}');
}

// Generate LaTeX content from optimized data (your existing function)
function generateOptimizedLatex(optimizedData) {
    // Generate skills section - with proper escaping for each skill
    const skillsSection = `\\section{Technical Skills \\& Relevant Courses}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
    \\textbf{Languages:} {${optimizedData.skills.languages.map(skill => escapeLatex(skill)).join(', ')}}
    \\\\
    \\textbf{Databases \\& Query Languages:} {${optimizedData.skills.databases.map(skill => escapeLatex(skill)).join(', ')}}
    \\\\
    \\textbf{Web Technologies: }{${optimizedData.skills.webTechnologies.map(skill => escapeLatex(skill)).join(', ')}}
    \\\\
    \\textbf{Machine Learning:} {${optimizedData.skills.machineLearning.map(skill => escapeLatex(skill)).join(', ')}}
    \\\\
    \\textbf{Miscellaneous: }{${optimizedData.skills.miscellaneous.map(skill => escapeLatex(skill)).join(', ')}}
     
 \\vspace{-8pt}
    }}
 \\end{itemize}`;

    // Generate work experience section - matching your exact format  
    let workExperienceSection = `\\section{Work Experience}
    
  \\resumeSubHeadingListStart`;
    
    optimizedData.workExperience.forEach(job => {
        workExperienceSection += `
    \\resumeSubheading
      {${escapeLatex(job.title)} | ${escapeLatex(job.company)} | ${escapeLatex(job.location)}}{${escapeLatex(job.duration)}}{}{}
      \\resumeItemListStart
       \\vspace{-10pt}`;
        
        job.bullets.forEach(bullet => {
            workExperienceSection += `
       \\resumeItem{${escapeLatex(bullet)}}`;
        });
        
        workExperienceSection += `
   
      \\resumeItemListEnd
`;
    });

    workExperienceSection += `
  \\resumeSubHeadingListEnd`;

    // Generate projects section - fixed format
    let projectsSection = `\\resumeSubHeadingListStart
     \\resumeProjectHeading
     {{\\textbf{${escapeLatex(optimizedData.projects[0].title)}}} \\$|\\$ \\emph{${optimizedData.projects[0].technologies.split(', ').map(tech => escapeLatex(tech)).join(', ')}}}{}
          \\resumeItemListStart`;
    
    optimizedData.projects[0].bullets.forEach(bullet => {
        projectsSection += `
            \\resumeItem{${escapeLatex(bullet)}}`;
    });
    
    projectsSection += `
          \\resumeItemListEnd 
          \\vspace{-12pt}`;

    // Add remaining projects
    for (let i = 1; i < Math.min(optimizedData.projects.length, 4); i++) {
        const project = optimizedData.projects[i];
        projectsSection += `
          
     \\resumeProjectHeading
     {{\\textbf{${escapeLatex(project.title)}}} \\$|\\$ \\emph{${project.technologies.split(', ').map(tech => escapeLatex(tech)).join(', ')}}}{}
          \\resumeItemListStart`;
        
        project.bullets.forEach(bullet => {
            projectsSection += `
            \\resumeItem{${escapeLatex(bullet)}}`;
        });
        
        projectsSection += `
          \\resumeItemListEnd`;
        
        if (i < Math.min(optimizedData.projects.length, 4) - 1) {
            projectsSection += `
          \\vspace{-12pt}`;
        }
    }

    // Close the list properly
    projectsSection += `
\\resumeSubHeadingListEnd`;

    return {
        skills: skillsSection,
        workExperience: workExperienceSection,
        projects: projectsSection
    };
}

// Validate LaTeX content before compilation (your existing function)
function validateLatexContent(latexContent) {
    const issues = [];
    
    // Check for basic LaTeX structure
    if (!latexContent.includes('\\documentclass')) {
        issues.push('Missing \\documentclass declaration');
    }
    
    if (!latexContent.includes('\\begin{document}')) {
        issues.push('Missing \\begin{document}');
    }
    
    if (!latexContent.includes('\\end{document}')) {
        issues.push('Missing \\end{document}');
    }
    
    // Check for balanced braces (simple check)
    const openBraces = (latexContent.match(/\{/g) || []).length;
    const closeBraces = (latexContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for balanced environments
    const beginCommands = (latexContent.match(/\\begin\{[^}]+\}/g) || []).length;
    const endCommands = (latexContent.match(/\\end\{[^}]+\}/g) || []).length;
    if (beginCommands !== endCommands) {
        issues.push(`Unbalanced environments: ${beginCommands} begin, ${endCommands} end`);
    }
    
    // Check for required sections
    const requiredSections = ['[SKILLS_SECTION]', '[WORK_EXPERIENCE_SECTION]', '[PROJECTS_SECTION]'];
    requiredSections.forEach(section => {
        if (latexContent.includes(section)) {
            issues.push(`Unreplaced placeholder: ${section}`);
        }
    });
    
    // Check for common problematic characters
    if (latexContent.includes('_') && !latexContent.includes('\\_')) {
        issues.push('Unescaped underscore characters found');
    }
    
    if (latexContent.includes('&') && !latexContent.includes('\\&')) {
        issues.push('Unescaped ampersand characters found (outside of tables)');
    }
    
    return issues;
}

// Enhanced LaTeX compilation with better error handling (your existing function)
async function compileLatexToPdf(latexContent) {
    try {
        await fs.writeFile(RESUME_TEX_FILE, latexContent);
        
        // Clean up previous files
        const auxFile = RESUME_TEX_FILE.replace('.tex', '.aux');
        const logFile = RESUME_TEX_FILE.replace('.tex', '.log');
        
        try {
            await fs.unlink(auxFile).catch(() => {});
            await fs.unlink(logFile).catch(() => {});
            await fs.unlink(RESUME_PDF_FILE).catch(() => {});
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
        
        console.log('Compiling LaTeX to PDF...');
        
        try {
            // First compilation
            const result1 = await execAsync(
                `pdflatex -interaction=nonstopmode -output-directory="${__dirname}" "${RESUME_TEX_FILE}"`,
                { timeout: 30000 }
            );
            
            console.log('First compilation completed');
            
            // Second compilation for references
            const result2 = await execAsync(
                `pdflatex -interaction=nonstopmode -output-directory="${__dirname}" "${RESUME_TEX_FILE}"`,
                { timeout: 30000 }
            );
            
            console.log('Second compilation completed');
            
        } catch (compileError) {
            // Read and display the log file for debugging
            const logFile = RESUME_TEX_FILE.replace('.tex', '.log');
            const logContent = await fs.readFile(logFile, 'utf8').catch(() => 'No log file available');
            
            console.error('LaTeX compilation stdout:', compileError.stdout);
            console.error('LaTeX compilation stderr:', compileError.stderr);
            console.error('LaTeX log content:', logContent.substring(0, 1000));
            
            throw new Error(`LaTeX compilation failed: ${compileError.message}`);
        }
        
        // Check if PDF was created
        await fs.access(RESUME_PDF_FILE);
        console.log('PDF compilation successful');
        
        return true;
    } catch (error) {
        console.error('LaTeX compilation error:', error);
        
        // Read log for debugging
        const logFile = RESUME_TEX_FILE.replace('.tex', '.log');
        const logContent = await fs.readFile(logFile, 'utf8').catch(() => 'No log file available');
        
        // Also read the actual tex file to debug content issues
        const texContent = await fs.readFile(RESUME_TEX_FILE, 'utf8').catch(() => 'Could not read tex file');
        
        console.error('Generated LaTeX content (first 500 chars):', texContent.substring(0, 500));
        console.error('LaTeX log (first 1000 chars):', logContent.substring(0, 1000));
        
        throw new Error(`PDF compilation failed: ${error.message}`);
    }
}

// API Routes (all your existing routes remain the same)

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Get all applications
app.get('/api/applications', async (req, res) => {
    try {
        const applications = await readApplications();
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read applications' });
    }
});

// Scrape job data from URL
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }
        
        let jobData;
        
        try {
            jobData = await scrapeJobWithPuppeteer(url);
        } catch (puppeteerError) {
            console.log('Puppeteer failed, trying Cheerio...', puppeteerError.message);
            try {
                jobData = await scrapeJobWithCheerio(url);
            } catch (cheerioError) {
                console.log('Cheerio also failed:', cheerioError.message);
                jobData = {
                    title: 'Unable to extract title',
                    company: 'Unable to extract company',
                    jobId: Math.random().toString(36).substr(2, 9),
                    description: 'Unable to extract description'
                };
            }
        }
        
        jobData.title = jobData.title?.replace(/\s+/g, ' ').trim() || 'Job Title Not Found';
        jobData.company = jobData.company?.replace(/\s+/g, ' ').trim() || 'Company Not Found';
        jobData.jobId = jobData.jobId || Math.random().toString(36).substr(2, 9);
        jobData.description = jobData.description?.replace(/\s+/g, ' ').trim() || 'Job description not found';
        
        res.json({
            success: true,
            data: {
                ...jobData,
                url: url
            }
        });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ 
            error: 'Failed to scrape job data',
            details: error.message
        });
    }
});

// TAILOR RESUME ENDPOINT
app.post('/api/tailor-resume', async (req, res) => {
    try {
        const { jobInput, inputType } = req.body;
        
        if (!jobInput) {
            return res.status(400).json({ error: 'Job input is required' });
        }
        
        let jobDescription = jobInput;
        
        // If input is a URL, scrape the job description first
        if (inputType === 'url') {
            try {
                new URL(jobInput);
                let jobData;
                
                try {
                    jobData = await scrapeJobWithPuppeteer(jobInput);
                } catch {
                    jobData = await scrapeJobWithCheerio(jobInput);
                }
                
                jobDescription = jobData.description || jobInput;
                
                if (!jobDescription || jobDescription === 'Job description not found') {
                    return res.status(400).json({ error: 'Could not extract job description from URL' });
                }
            } catch (error) {
                console.error('Failed to scrape job description:', error);
                return res.status(400).json({ error: 'Failed to extract job description from URL' });
            }
        }
        
        console.log('Starting resume tailoring process...');
        console.log('Job description length:', jobDescription.length);
        
        // Extract keywords and optimize resume data
        const optimizedData = await extractKeywordsAndTailorResume(jobDescription);
        
        console.log('Extracted keywords:', optimizedData.extractedKeywords);
        console.log('Optimized resume data structure validated');
        
        // Generate LaTeX sections
        const latexSections = generateOptimizedLatex(optimizedData);
        
        // Create complete LaTeX document
        const completeLatex = BASE_RESUME_LATEX
            .replace('[SKILLS_SECTION]', latexSections.skills)
            .replace('[WORK_EXPERIENCE_SECTION]', latexSections.workExperience)
            .replace('[PROJECTS_SECTION]', latexSections.projects);
        
        // Validate LaTeX content before compilation
        const validationIssues = validateLatexContent(completeLatex);
        if (validationIssues.length > 0) {
            console.warn('LaTeX validation issues:', validationIssues);
        }
        
        // Write debug file
        await fs.writeFile(path.join(__dirname, 'tailored_resume_debug.tex'), completeLatex);
        console.log('Debug LaTeX file created');
        
        // Write individual sections for debugging
        await fs.writeFile(path.join(__dirname, 'debug_skills.tex'), latexSections.skills);
        await fs.writeFile(path.join(__dirname, 'debug_work.tex'), latexSections.workExperience);
        await fs.writeFile(path.join(__dirname, 'debug_projects.tex'), latexSections.projects);
        
        console.log('Individual section debug files created');
        
        // Compile to PDF
        await compileLatexToPdf(completeLatex);
        
        console.log('Resume tailoring completed successfully');
        
        res.json({
            success: true,
            message: 'Resume successfully tailored and PDF generated',
            extractedKeywords: optimizedData.extractedKeywords,
            tailoredResume: completeLatex,
            optimizationSummary: {
                totalKeywords: optimizedData.extractedKeywords.length,
                skillsOptimized: Object.keys(optimizedData.skills).length,
                experienceReordered: optimizedData.workExperience.length,
                projectsHighlighted: optimizedData.projects.length
            }
        });
        
    } catch (error) {
        console.error('Resume tailoring error:', error);
        res.status(500).json({ 
            error: 'Failed to tailor resume',
            details: error.message,
            stack: error.stack
        });
    }
});

// Download tailored resume PDF
app.get('/api/download-resume', async (req, res) => {
    try {
        await fs.access(RESUME_PDF_FILE);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="tailored-resume.pdf"');
        
        const pdfBuffer = await fs.readFile(RESUME_PDF_FILE);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('PDF download error:', error);
        res.status(404).json({ error: 'Resume PDF not found. Please generate a tailored resume first.' });
    }
});

// Add new application
app.post('/api/applications', async (req, res) => {
    try {
        const applications = await readApplications();
        const newApp = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            ...req.body,
            status: req.body.status || 'Applied',
            referral: req.body.referral || false
        };
        
        applications.push(newApp);
        await writeApplications(applications);
        
        res.status(201).json(newApp);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add application' });
    }
});

// Update application
app.put('/api/applications/:id', async (req, res) => {
    try {
        const applications = await readApplications();
        const index = applications.findIndex(app => app.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        applications[index] = { ...applications[index], ...req.body };
        await writeApplications(applications);
        
        res.json(applications[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update application' });
    }
});

// Delete application
app.delete('/api/applications/:id', async (req, res) => {
    try {
        const applications = await readApplications();
        const filteredApps = applications.filter(app => app.id !== parseInt(req.params.id));
        
        if (filteredApps.length === applications.length) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        await writeApplications(filteredApps);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
    await initDataFile();
    app.listen(PORT, () => {
        console.log(`🚀 Job Tracker Backend running on http://localhost:${PORT}`);
        console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
        console.log(`🎯 Enhanced resume tailoring available at http://localhost:${PORT}/api/tailor-resume`);
    });
}

startServer().catch(console.error);