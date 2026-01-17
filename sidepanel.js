document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIG VARIABLES ---
    const apiKeyInput = document.getElementById('api-key');
    const saveKeyBtn = document.getElementById('save-key-btn');
    
    // Mode Buttons
    const modeProductBtn = document.getElementById('mode-product');
    const modeInfluencerBtn = document.getElementById('mode-influencer');
    const influencerControls = document.getElementById('influencer-controls');
    
    // Inputs
    const conceptInput = document.getElementById('concept');
    const videoScriptInput = document.getElementById('video-script');
    const fillBtn = document.getElementById('fill-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    // Output
    const outputSection = document.getElementById('output-section');
    const promptsContainer = document.getElementById('prompts-container');
    const statusText = document.getElementById('status-text');
    const statusPanel = document.getElementById('status-display');

    // Specific Inputs
    const genderSelect = document.getElementById('gender-select');
    const nationalitySelect = document.getElementById('nationality-select');
    const actionSelect = document.getElementById('presenter-action');
    const bgSelect = document.getElementById('background-select');
    
    // Image
    const productImageInput = document.getElementById('product-image');
    const imagePreview = document.getElementById('image-preview');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    let base64ImageData = null;
    let imageMimeType = null;
    let currentMode = 'influencer';

    // --- 2. HELPERS ---
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function fetchWithRetry(url, options, retries = 3, delay = 2000) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.status === 429) {
                    updateStatus(`รอสักครู่ (${i+1}/${retries})...`, 'orange');
                    await wait(delay * (i + 1));
                    continue;
                }
                if (!response.ok) throw new Error(`${response.status}`);
                return response;
            } catch (error) {
                lastError = error;
                if (i === retries - 1) throw lastError;
                await wait(delay);
            }
        }
        throw lastError;
    }

    function updateStatus(text, color) {
        if(statusText) { statusText.innerText = text; statusText.style.color = color; }
        if(statusPanel) statusPanel.style.borderColor = color;
    }

    // --- 3. EVENT LISTENERS ---
    function setMode(mode) {
        currentMode = mode;
        if (mode === 'influencer') {
            modeInfluencerBtn.classList.add('active');
            modeProductBtn.classList.remove('active');
            if(influencerControls) influencerControls.classList.remove('hidden'); 
        } else {
            modeProductBtn.classList.add('active');
            modeInfluencerBtn.classList.remove('active');
            if(influencerControls) influencerControls.classList.add('hidden'); 
        }
    }
    if(modeInfluencerBtn) modeInfluencerBtn.addEventListener('click', () => setMode('influencer'));
    if(modeProductBtn) modeProductBtn.addEventListener('click', () => setMode('product'));

    // API Key
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            updateStatus('พร้อมใช้งาน', '#00ff00');
        }
    });
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) chrome.storage.local.set({ geminiApiKey: key }, () => updateStatus('บันทึกแล้ว', '#00ff00'));
    });

    // Image Upload
    if (productImageInput) {
        productImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    base64ImageData = ev.target.result.split(',')[1];
                    imageMimeType = file.type;
                    if (imagePreview) {
                        imagePreview.src = ev.target.result;
                        imagePreviewContainer.classList.remove('hidden');
                    }
                    updateStatus('รูปพร้อมแล้ว', '#00ff00');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- 4. AI FEATURE: Concept + Hashtags ---
    const autoConceptBtn = document.getElementById('auto-concept-btn');
    if (autoConceptBtn) {
        autoConceptBtn.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            if (!apiKey) return updateStatus('ใส่ API Key ก่อนครับ', 'red');
            const model = document.getElementById('model-select')?.value || 'gemini-2.0-flash';
            updateStatus('กำลังคิดคอนเซปต์...', 'yellow');
            try {
                const promptText = `
Role: Viral TikTok Strategist Thailand.
Task: Write a short, punchy product hook in Thai.
Constraint: YOU MUST END WITH 10 VIRAL THAI HASHTAGS.
                `;
                const parts = [{ text: promptText }];
                if (base64ImageData) {
                    parts.push({ inline_data: { mime_type: imageMimeType, data: base64ImageData } });
                }
                const response = await fetchWithRetry(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
                );
                const data = await response.json();
                conceptInput.value = data.candidates[0].content.parts[0].text.trim();
                updateStatus('ได้คอนเซปต์แล้ว! ✨', '#00ff00');
            } catch (e) {
                updateStatus('Error: ' + e.message, 'red');
            }
        });
    }

    const autoScriptBtn = document.getElementById('auto-script-btn');
    if (autoScriptBtn) {
        autoScriptBtn.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            const concept = conceptInput.value;
            if (!apiKey) return updateStatus('ใส่ API Key ก่อนครับ', 'red');
            const model = document.getElementById('model-select')?.value || 'gemini-2.0-flash';
            updateStatus('กำลังเขียนบท...', 'yellow');
            try {
                const parts = [{
                    text: `Write a very short Thai script (spoken language, 2 sentences max) based on: "${concept}". Only return Thai text.`
                }];
                const response = await fetchWithRetry(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
                );
                const data = await response.json();
                videoScriptInput.value = data.candidates[0].content.parts[0].text.replace(/["*]/g, '').trim();
                updateStatus('ได้บทพูดแล้ว 🗣️', '#00ff00');
            } catch (e) {
                updateStatus('Error: ' + e.message, 'red');
            }
        });
    }

    // --- 5. MAIN GENERATE LOGIC ---
    fillBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const concept = conceptInput.value.trim();
        const model = document.getElementById('model-select') ? document.getElementById('model-select').value : 'gemini-2.5-flash';
        
        const gender = genderSelect ? genderSelect.value : 'Female';
        const nation = nationalitySelect ? nationalitySelect.value : 'Thai';
        const action = actionSelect ? actionSelect.value : 'holding_show';
        const background = bgSelect ? bgSelect.value : 'Blurred Room';
        const scriptText = videoScriptInput.value.trim();

        if (!apiKey || !concept) return updateStatus('ข้อมูลไม่ครบ', 'red');
        if (!base64ImageData) return updateStatus('ต้องใส่รูปสินค้า!', 'red');

        updateStatus('กำลังสร้าง Prompt...', 'yellow');
        promptsContainer.innerHTML = '<div class="empty-state">กำลังประมวลผล...</div>';
        outputSection?.classList.remove('hidden');

        try {
// ==================================================================================
// --- ส่วนที่แก้ไข (V3): เน้นเรื่องเสียงพูด และ ความเหมือนจริงของสินค้าขั้นสูงสุด ---
// ==================================================================================
const systemPrompt = `
You are an expert Video Generation Prompt Engineer. Your task is to create a highly detailed prompt for a video model.

*** CRITICAL INSTRUCTIONS (FAILURE TO FOLLOW = INVALID OUTPUT) ***

1.  **AUDIO IS MANDATORY & SYNCHRONIZED:**
    - The generated video MUST contain clear, audible spoken audio.
    - The character MUST speak the provided Thai script.
    - **Lip Synchronization:** The character's lips must move naturally in sync with the spoken words.
    - A silent video is unacceptable.

2.  **PRODUCT FIDELITY: ZERO DEVIATION**
    - The reference image is the absolute truth for the product's appearance.
    - Do NOT "re-imagine," "improve," or "stylize" the product packaging.
    - Every label text, logo, color code, and shape must match the image precisely.
    - The product must look photorealistic, not cartoonish.

3.  **VIDEO FORMAT: RAW & CLEAN**
    - Output: Raw camera footage (9:16 vertical full frame).
    - FORBIDDEN: No UI, no phone bezels, no text overlays, no app interfaces.

4.  **OUTPUT FORMAT**
    - Return strictly JSON: {"prompt": "...", "script": "..."}
`;

const userPrompt = `
CONTEXT:
${concept}

SCRIPT (THAI ONLY - **MUST BE AUDIBLE SPOKEN W/ LIP SYNC**):
${videoScriptInput.value}

GENERATE A DETAILED PROMPT FOR THIS SCENE:
- **Type:** Real-life camera footage with clear audio.
- **Character:** ${gender}, ${nation} look, speaking clearly into the camera.
- **Action:** ${action}, while speaking.
- **Background:** ${background}
- **Product:** The EXACT product from the image (Photorealistic fidelity required).

STRICT NEGATIVE PROMPT (Include these constraints):
**NO silent video, NO muffled audio, NO background music overpowering speech.**
No phone bezel, no UI, no text overlay, no subtitles.
**NO distorted product labels, NO wrong colors, NO reimagined packaging.**

Ensure the prompt explicitly describes the *sound* of the voice and the *movement* of the lips syncing to the Thai script.
`;
// ==================================================================================
// --- จบส่วนที่แก้ไข (V3) ---
// ==================================================================================

            const parts = [
                { text: systemPrompt + "\n\n" + userPrompt },
                { inline_data: { mime_type: imageMimeType, data: base64ImageData } }
            ];

            const response = await fetchWithRetry(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
            );

            const data = await response.json();
            let generatedText = data.candidates[0].content.parts[0].text
                .replace(/^```json|```$/g, '')
                .trim();

            let resultObj = { prompt: generatedText, script: videoScriptInput.value };
            try { resultObj = JSON.parse(generatedText); } catch {}

            // UI Display
            promptsContainer.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'prompt-card';
            
            card.innerHTML = `
                <div class="card-body">
                    <strong>Prompt (${currentMode}):</strong><br>${resultObj.prompt}
                    <br><br>
                    <strong>Script:</strong> ${resultObj.script || '-'}
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;" id="btn-container"></div>
            `;
            const btnContainer = card.querySelector('#btn-container');

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '📋 คัดลอก';
            copyBtn.onclick = () => { navigator.clipboard.writeText(`${resultObj.prompt}\n\nScript: ${resultObj.script}`); updateStatus('คัดลอกแล้ว', '#00ff00'); };
            btnContainer.appendChild(copyBtn);

            // Send Button (Retry Logic)
            const sendBtn = document.createElement('button');
            sendBtn.className = 'copy-btn';
            sendBtn.style.borderColor = 'var(--neon-blue)';
            sendBtn.style.color = 'var(--neon-blue)';
            sendBtn.innerHTML = '🚀 ส่งไป Flow';
            
            sendBtn.addEventListener('click', () => {
                 chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    const activeTab = tabs[0];
                    if (activeTab && (activeTab.url.includes("labs.google") || activeTab.url.includes("aitestkitchen"))) {
                        updateStatus('กำลังส่ง...', 'yellow');
                        let attempts = 0;
                        const maxAttempts = 5;
                        const trySendMessage = () => {
                            chrome.tabs.sendMessage(activeTab.id, {
                                action: "FILL_FLOW_PROMPT",
                                prompt: resultObj.prompt,
                                imageData: base64ImageData,
                                mimeType: imageMimeType,
                                targetRatio: "9:16",
                                targetCount: 1 
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    attempts++;
                                    console.warn(`Retry ${attempts}/${maxAttempts}`);
                                    if (attempts < maxAttempts) setTimeout(trySendMessage, 1000);
                                    else updateStatus('ส่งไม่ไป (กด F5 ที่เว็บ Flow)', 'red');
                                } else {
                                    updateStatus('ส่งสำเร็จ! 🚀', '#00ff00');
                                }
                            });
                        };
                        trySendMessage(); 
                    } else {
                        updateStatus('เปิด VideoFX ก่อน', 'orange');
                    }
                });
            });

            btnContainer.appendChild(sendBtn);
            promptsContainer.appendChild(card);
            updateStatus('สร้างเสร็จสิ้น', '#00f3ff');

        } catch (error) {
            console.error(error);
            updateStatus('Error: ' + error.message, 'red');
            promptsContainer.innerHTML = `<div style="color:red">Error: ${error.message}</div>`;
        }
    });
    
    // Clear Button
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if(promptsContainer) promptsContainer.innerHTML = '';
        if(outputSection) outputSection.classList.add('hidden');
        if(conceptInput) conceptInput.value = '';
        if(videoScriptInput) videoScriptInput.value = '';
        if(productImageInput) productImageInput.value = ''; 
        base64ImageData = null;
        imageMimeType = null;
        if(imagePreview) imagePreview.src = '#';
        if(imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
        updateStatus('ล้างข้อมูลแล้ว', '#00f3ff');
    });
    
    function getActionDescription(key) {
        const actions = {
            holding_show: 'holding the real product naturally and speaking Thai',
            pointing: 'pointing at the real product while speaking Thai',
            using: 'using the real product naturally',
            hugging: 'holding the real product close'
        };
        return actions[key] || 'speaking Thai naturally';
    }
});