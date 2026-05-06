require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads folder

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Database connection config
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Swethahari722',
    database: 'career_app'
};

let pool;

async function initDB() {
    try {
        // First connect without database to create it if it doesn't exist
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        await connection.end();

        // Create connection pool with database selected
        pool = mysql.createPool(dbConfig);

        // Create Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255)
            )
        `);

        // Create Saved Jobs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                job_id VARCHAR(255),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create Jobs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id VARCHAR(255) PRIMARY KEY,
                type VARCHAR(50),
                title VARCHAR(255),
                company VARCHAR(255),
                location VARCHAR(255),
                locationType VARCHAR(50),
                skills TEXT,
                description TEXT,
                link VARCHAR(255)
            )
        `);

        // Seed mock jobs if empty
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM jobs");
        if (rows[0].count === 0) {
            const mockJobs = [
                ["1", "job", "Frontend Developer", "TechCorp", "Remote", "remote", "React, JavaScript, CSS, HTML", "Join our fast-paced remote team to build intuitive user interfaces. You will work closely with designers and backend engineers to deliver high-quality web applications using modern React patterns.", "https://careers.google.com/jobs/results/1"],
                ["2", "job", "Backend Engineer", "DataSystems Inc", "New York, NY", "onsite", "Node.js, Express, SQL, AWS", "We are looking for a robust Backend Engineer to scale our infrastructure. You will optimize database queries, design RESTful APIs, and manage AWS deployments for our core product.", "https://careers.google.com/jobs/results/2"],
                ["3", "job", "Data Scientist", "AI Solutions", "San Francisco, CA", "onsite", "Python, Machine Learning, Data Analysis, Pandas", "Help us uncover insights from massive datasets. You will build predictive models, perform complex data analysis, and present findings to key stakeholders.", "https://careers.google.com/jobs/results/3"],
                ["4", "job", "Digital Marketing Manager", "GrowthHackers", "London, UK", "onsite", "Marketing, SEO, Content Strategy, Google Analytics", "Lead our digital marketing initiatives. You will design SEO strategies, manage content pipelines, and analyze campaign performance to drive exponential growth.", "https://careers.google.com/jobs/results/4"],
                ["5", "job", "UI/UX Designer", "Creative Studio", "Remote", "remote", "Figma, Design, User Research, Prototyping", "Create beautiful and functional designs. You will conduct user research, build interactive prototypes in Figma, and ensure a seamless user experience across all our platforms.", "https://careers.google.com/jobs/results/5"],
                ["6", "internship", "Software Engineering Intern", "StartupX", "Remote", "remote", "JavaScript, Node.js, Git", "Kickstart your career with StartupX. As an intern, you will contribute to real-world projects, learn agile methodologies, and get hands-on experience with modern tech stacks.", "https://careers.google.com/jobs/results/6"],
                ["7", "internship", "Marketing Intern", "BrandBoost", "Austin, TX", "onsite", "Marketing, Social Media, Communication", "Assist our marketing team in executing social media campaigns. You will draft content, engage with our community, and help analyze social media metrics.", "https://careers.google.com/jobs/results/7"],
                ["8", "internship", "Data Analytics Intern", "FinTech Group", "Chicago, IL", "onsite", "Data Analysis, Excel, Python, SQL", "Support our data team by cleaning datasets, running SQL queries, and creating reports in Excel. A great opportunity to learn about financial data systems.", "https://careers.google.com/jobs/results/8"],
                ["9", "internship", "Web Development Intern", "WebWorks", "Seattle, WA", "onsite", "HTML, CSS, JavaScript, React", "Learn the fundamentals of web development. You will help maintain client websites, fix UI bugs, and learn best practices for responsive design.", "https://careers.google.com/jobs/results/9"],
                ["10", "internship", "Product Management Intern", "Innovate LLC", "Boston, MA", "onsite", "Project Management, Agile, Communication", "Work alongside experienced Product Managers. You will help draft product requirements, participate in user interviews, and learn how to manage a product roadmap.", "https://careers.google.com/jobs/results/10"]
            ];
            
            const insertQuery = "INSERT INTO jobs (id, type, title, company, location, locationType, skills, description, link) VALUES ?";
            await pool.query(insertQuery, [mockJobs]);
        }
        
        console.log("Database initialized and connected successfully!");
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
}

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await pool.query('SELECT id, username FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            res.json({ success: true, user: users[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const [result] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
        res.json({ success: true, user: { id: result.insertId, username } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Username already exists' });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

// Recommendation Engine (Live Jobs via Remotive API)
app.post('/api/recommendations', async (req, res) => {
    const { skills, interests, type } = req.body;
    
    try {
        // Construct search query
        // E.g. "software engineer", or pick the first skill if available
        let searchQuery = interests;
        if (!searchQuery && skills.length > 0) {
            searchQuery = skills[0];
        } else if (!searchQuery) {
            searchQuery = type === 'internship' ? 'intern' : 'developer';
        }

        const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(searchQuery)}&limit=50`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.jobs) {
            return res.json({ success: false, message: "Failed to fetch jobs from Remotive API" });
        }

        let jobsResults = data.jobs;

        // Map Remotive API results to frontend format and calculate score
        let scoredJobs = jobsResults.map((job) => {
            let score = 0;
            const jobTitle = (job.title || "").toLowerCase();
            const jobDesc = (job.description || "").toLowerCase();
            const jobTags = (job.tags || []).map(t => t.toLowerCase());
            
            const userSkills = skills.map(s => s.toLowerCase());
            const userInterests = interests ? interests.toLowerCase() : "";
            
            let interestMatched = false;

            if (userInterests) {
                // Strictly require the job title or tags to contain the full interested role
                // to ensure 'Data Analyst' only returns 'Data Analyst' roles and not 'Data Engineer'
                if (jobTitle.includes(userInterests) || jobTags.some(t => t.includes(userInterests))) {
                    interestMatched = true;
                    score += 5;
                }
            } else {
                interestMatched = true; // If no interest provided, assume match
            }

            userSkills.forEach(skill => {
                if (jobDesc.includes(skill)) {
                    score += 2;
                } else if (jobTitle.includes(skill) || jobTags.some(t => t.includes(skill) || skill.includes(t))) {
                    score += 1;
                }
            });
            
            // The user requested: "show the jobs that only matches the intrested area"
            // So if it doesn't match the interested area (in title or tags), reject it completely.
            if (!interestMatched) {
                score = 0;
            }
            
            const totalPossibleScore = (userSkills.length * 2) + (userInterests ? 3 : 0);
            let matchPercentage = totalPossibleScore > 0 ? Math.min(Math.round((score / totalPossibleScore) * 100), 100) : 0;
            
            return {
                id: `remotive_${job.id}`,
                type: type || "job",
                title: job.title,
                company: job.company_name,
                location: job.candidate_required_location || 'Remote',
                locationType: 'remote',
                skills: job.tags ? job.tags.slice(0, 3) : skills.slice(0, 3), 
                description: job.description ? job.description.replace(/<[^>]*>?/gm, '').substring(0, 200) + "..." : "No description available.",
                link: job.url || "#",
                score: score,
                matchPercentage: matchPercentage
            };
        });

        // Filter out jobs that have no matching skills/interests (score === 0)
        scoredJobs = scoredJobs.filter(job => job.score > 0);

        // Sort by score
        scoredJobs.sort((a, b) => b.score - a.score);
        
        // Take top 10
        const topJobs = scoredJobs.slice(0, 10);

        res.json({ success: true, data: topJobs });
    } catch (err) {
        console.error("Error fetching from Remotive:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Saved Jobs Logic
app.get('/api/saved_jobs', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ success: false, message: 'Missing user_id' });
    
    try {
        const [savedJobs] = await pool.query(`
            SELECT j.* FROM jobs j
            JOIN saved_jobs sj ON j.id = sj.job_id
            WHERE sj.user_id = ?
        `, [user_id]);
        
        savedJobs.forEach(job => {
            job.skills = (job.skills || "").split(',').map(s => s.trim());
        });
        
        res.json({ success: true, data: savedJobs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/save_job', async (req, res) => {
    const { user_id, job_id } = req.body;
    if (!user_id || !job_id) return res.status(400).json({ success: false, message: 'Missing user_id or job_id' });
    
    try {
        const [existing] = await pool.query('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?', [user_id, job_id]);
        if (existing.length === 0) {
            await pool.query('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)', [user_id, job_id]);
        }
        res.json({ success: true, message: 'Job saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/unsave_job', async (req, res) => {
    const { user_id, job_id } = req.body;
    try {
        await pool.query('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [user_id, job_id]);
        res.json({ success: true, message: 'Job unsaved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Resume Upload Endpoint
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
    const { user_id, name, email, phone, degree, address, projects } = req.body;
    const resumePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!user_id) return res.status(400).json({ success: false, message: 'Missing user_id' });

    try {
        // Build update query dynamically
        let updates = [];
        let params = [];
        
        if (resumePath) {
            updates.push('resume_path = ?');
            params.push(resumePath);
        }
        // You can add logic here to update other profile fields in the database later
        // e.g., updates.push('full_name = ?'); params.push(name);
        
        if (updates.length > 0) {
            params.push(user_id);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        
        res.json({ success: true, message: 'Profile updated successfully', resume_path: resumePath });
    } catch (err) {
        console.error('Error uploading resume:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Profile Endpoint
app.get('/api/profile', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ success: false, message: 'Missing user_id' });
    
    try {
        const [users] = await pool.query('SELECT id, username, email, resume_path FROM users WHERE id = ?', [user_id]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Initialize DB and start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
