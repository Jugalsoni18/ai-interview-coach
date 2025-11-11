document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('resume-form');
    const loadingSection = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    const matchSummary = document.getElementById('match-summary');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const resumeFile = document.getElementById('resumeFile').files[0];
        const jobDescription = document.getElementById('job_description').value;

        if (!resumeFile) {
            alert('Please select a resume file');
            return;
        }

        // Show loading spinner
        loadingSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        // Create form data to send to the server
        const formData = new FormData();
        formData.append('resumeFile', resumeFile);
        if (jobDescription) {
            formData.append('job_description', jobDescription);
        }

        // Send the resume to the server for analysis
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Log the data for debugging
            console.log("Received data from server:", data);

            // Display the results
            displayResults(data, jobDescription);

            // Hide loading spinner
            loadingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while analyzing the resume. Please try again.');
            loadingSection.classList.add('hidden');
        });
    });

    function displayResults(results, jobDescription) {
        // Display extracted text
        document.getElementById('extracted-text').textContent = results.extractedText;

        // Display strengths
        document.getElementById('strengths-content').innerHTML = formatContent(results.strengths);

        // Match score box has been removed from the HTML

        // Map the response fields to our UI
        // Areas to improve goes to skills gaps
        document.getElementById('skills-gaps-content').innerHTML = formatContent(results.areasToImprove);

        // ATS issues goes to suggestions
        document.getElementById('suggestions-content').innerHTML = formatContent(results.atsIssues);

        // Missing skills goes to missing keywords
        document.getElementById('keywords-content').innerHTML = formatContent(results.missingSkills);

        // Update progress bars
        // Make sure atsPercentage is a number between 0 and 100
        let atsPercentage = 0;
        let atsScore = 0;

        // First check if atsPercentage is directly available
        if (typeof results.atsPercentage === 'number') {
            atsPercentage = results.atsPercentage;
            atsScore = results.atsScore || atsPercentage / 10;
        }
        // If not, calculate from atsScore
        else if (typeof results.atsScore === 'number') {
            atsScore = results.atsScore;
            atsPercentage = Math.round(atsScore * 10);
        }
        // If still not available, try to extract from raw response text
        else if (results.rawResponse) {
            const atsScoreMatch = results.rawResponse.match(/ATS.*?Score.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
            if (atsScoreMatch && atsScoreMatch[1]) {
                atsScore = parseFloat(atsScoreMatch[1]);
                atsPercentage = Math.round(atsScore * 10);
                console.log("Extracted ATS score from raw text:", atsScore);
            }
        }

        // If still not available, try to extract from atsIssues section
        if (atsScore === 0 && results.atsIssues) {
            console.log("Looking for ATS score in atsIssues:", results.atsIssues.substring(0, 200));

            // Try multiple patterns to find the ATS score in atsIssues
            const atsPatterns = [
                /ATS.*?Score.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
                /ATS.*?Score.*?[:|=]?\s*(\d+(?:\.\d+)?)/i,
                /ATS.*?Compatibility.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
                /ATS.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i
            ];

            for (const pattern of atsPatterns) {
                const issuesAtsMatch = results.atsIssues.match(pattern);
                if (issuesAtsMatch && issuesAtsMatch[1]) {
                    atsScore = parseFloat(issuesAtsMatch[1]);
                    atsPercentage = Math.round(atsScore * 10);
                    console.log("Extracted ATS score from atsIssues:", atsScore);
                    break;
                }
            }
        }

        // Last resort: search for any number followed by /10 in the entire content
        if (atsScore === 0 && results.rawResponse) {
            // Look for "ATS Compatibility Score: 8/10" in the entire text
            const fullTextMatch = results.rawResponse.match(/ATS\s+Compatibility\s+Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
            if (fullTextMatch && fullTextMatch[1]) {
                atsScore = parseFloat(fullTextMatch[1]);
                atsPercentage = Math.round(atsScore * 10);
                console.log("Extracted ATS score from full text:", atsScore);
            }
        }

        // Ensure the percentage is within valid range
        atsPercentage = Math.max(0, Math.min(100, atsPercentage));

        // Update ATS progress bar
        const atsProgressBar = document.getElementById('ats-progress');
        atsProgressBar.style.width = atsPercentage + '%';
        document.getElementById('ats-percentage').textContent = atsPercentage;

        // Also display the raw score in the UI
        const atsScoreElement = document.getElementById('ats-raw-score');
        if (atsScoreElement) {
            atsScoreElement.textContent = atsScore.toFixed(1);
            console.log("Displaying ATS raw score:", atsScore.toFixed(1));
        }

        // Set color based on score
        if (atsPercentage < 40) {
            atsProgressBar.style.backgroundColor = '#e74c3c'; // Red for low scores
        } else if (atsPercentage < 70) {
            atsProgressBar.style.backgroundColor = '#f39c12'; // Orange for medium scores
        } else {
            atsProgressBar.style.backgroundColor = '#2ecc71'; // Green for high scores
        }

        if (results.hasJobDescription) {
            // Make sure matchPercentage is a number between 0 and 100
            let matchPercentage = 0;
            let matchScore = 0;

            // First check if matchPercentage is directly available
            if (typeof results.matchPercentage === 'number') {
                matchPercentage = results.matchPercentage;
                matchScore = results.matchScore || matchPercentage / 10;
            }
            // If not, calculate from matchScore
            else if (typeof results.matchScore === 'number') {
                matchScore = results.matchScore;
                matchPercentage = Math.round(matchScore * 10);
            }
            // If still not available, try to extract from raw response text
            else if (results.rawResponse) {
                const matchScoreMatch = results.rawResponse.match(/Job Match Score.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
                if (matchScoreMatch && matchScoreMatch[1]) {
                    matchScore = parseFloat(matchScoreMatch[1]);
                    matchPercentage = Math.round(matchScore * 10);
                    console.log("Extracted Match score from raw text:", matchScore);
                }
            }

            // If still not available, try to extract from missingSkills section
            if (matchScore === 0 && results.missingSkills) {
                console.log("Looking for Match score in missingSkills:", results.missingSkills.substring(0, 200));

                // Try multiple patterns to find the Match score in missingSkills
                const matchPatterns = [
                    /Job Match Score.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
                    /Match.*?Score.*?[:|=]?\s*(\d+(?:\.\d+)?)/i,
                    /Match.*?[:|=]?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i
                ];

                for (const pattern of matchPatterns) {
                    const skillsMatchMatch = results.missingSkills.match(pattern);
                    if (skillsMatchMatch && skillsMatchMatch[1]) {
                        matchScore = parseFloat(skillsMatchMatch[1]);
                        matchPercentage = Math.round(matchScore * 10);
                        console.log("Extracted Match score from missingSkills:", matchScore);
                        break;
                    }
                }
            }

            // Last resort: search for any number followed by /10 in the entire content
            if (matchScore === 0 && results.rawResponse) {
                // Look for "Job Match Score: X/10" in the entire text
                const fullTextMatch = results.rawResponse.match(/Job\s+Match\s+Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
                if (fullTextMatch && fullTextMatch[1]) {
                    matchScore = parseFloat(fullTextMatch[1]);
                    matchPercentage = Math.round(matchScore * 10);
                    console.log("Extracted Match score from full text:", matchScore);
                }
            }

            // Ensure the percentage is within valid range
            matchPercentage = Math.max(0, Math.min(100, matchPercentage));

            // Update match progress bar
            const matchProgressBar = document.getElementById('match-progress');
            matchProgressBar.style.width = matchPercentage + '%';
            document.getElementById('match-percentage').textContent = matchPercentage;

            // Also display the raw score in the UI
            const matchScoreElement = document.getElementById('match-raw-score');
            if (matchScoreElement) {
                matchScoreElement.textContent = matchScore.toFixed(1);
                console.log("Displaying Match raw score:", matchScore.toFixed(1));
            }

            // Set color based on score
            if (matchPercentage < 40) {
                matchProgressBar.style.backgroundColor = '#e74c3c'; // Red for low scores
            } else if (matchPercentage < 70) {
                matchProgressBar.style.backgroundColor = '#f39c12'; // Orange for medium scores
            } else {
                matchProgressBar.style.backgroundColor = '#2ecc71'; // Green for high scores
            }
        }

        // Show/hide match summary based on job description
        if (results.hasJobDescription) {
            matchSummary.style.display = 'block';
        } else {
            matchSummary.style.display = 'none';
        }
    }

    function formatContent(content) {
        // Convert markdown-like content to HTML
        if (!content) return '';

        // Replace asterisks with bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert bullet points
        content = content.replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>');
        content = content.replace(/<li>(.+)<\/li>/g, function(match) {
            if (content.indexOf('<ul>') === -1) {
                return '<ul>' + match + '</ul>';
            }
            return match;
        });

        // Ensure proper nesting of lists
        let parts = content.split('<ul>');
        for (let i = 1; i < parts.length; i++) {
            if (!parts[i].includes('</ul>')) {
                parts[i] += '</ul>';
            }
        }
        content = parts.join('<ul>');

        // Convert line breaks to paragraphs
        content = '<p>' + content.replace(/\n\n+/g, '</p><p>') + '</p>';
        content = content.replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>');

        return content;
    }
});
