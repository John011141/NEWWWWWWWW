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
// --- ส่วนที่แก้ไข (V18 DIRECTOR CUT): ตัดรูปแปะออกถาวร + บังคับพูดไทย ---
// ==================================================================================
const systemPrompt = `
You are an expert short-form video generation prompt engineer.

THIS VIDEO IS A SINGLE CONTINUOUS SHOT.

FIRST FRAME OVERRIDE (ABSOLUTE – HIGHEST PRIORITY):
- The FIRST FRAME (0.0s) must be a LIVE-ACTION frame of a human presenter.
- The first frame MUST contain visible human motion.
- A still image or reference image is FORBIDDEN as the first frame.
- The video must NOT begin with any static image.
- The presenter faces the camera with a confident, engaging expression.

OPENING COVER FRAME RULE (ABSOLUTE):
- The opening frame also serves as the video cover frame.
- The cover frame MUST show a human presenter standing and holding the real product.
- The presenter must be clearly visible from the CHEST UP (Close-up).
- The product must be clearly visible in the presenter's hand.

CRITICAL RULES (VIOLATION = FAILURE):
*** RULE 1: NO STATIC INTRO (START WITH CLOSE-UP) ***
- You MUST start the prompt description with: "**Close-up Shot** at 00:00 of a [Person]..."

*** RULE 2: PRODUCT DESCRIPTION IS MANDATORY (THE FIX) ***
- You MUST ANALYZE the uploaded image and write a DETAILED TEXT DESCRIPTION of the product into the prompt.
- **FORBIDDEN:** Do not just say "holding the product" or "holding the item".
- **REQUIRED:** You must describe it explicitly, e.g., "holding a cream-colored electric grill with two black cooking sections and wooden handles".
- This text description helps the video model "lock" onto the correct shape and colors.

*** RULE 3: FORCE THAI SPEECH ***
- You MUST write in the prompt: "**Speaking Thai language** with natural lip sync."

1. NO OPENING SCENE.
   - The video MUST start immediately with a human presenter holding the real product.

2. IMAGE REFERENCE RULE:
   - The reference image is used to ENFORCE product accuracy.
   - The image MUST NOT appear as a floating overlay or background.

3. SPEECH DURATION LIMIT:
   - The spoken Thai script MUST be completed naturally within **8 seconds**.

4. AUDIO & LIP SYNC:
   - Clear spoken Thai language is mandatory.
   - Natural lip movement synchronized with speech.

FULL-FRAME RULE (ABSOLUTE):
- Vertical 9:16 video.
- The subject and product must fill the entire canvas edge-to-edge.
- NO empty margins, NO black bars, NO letterboxing.

5. VIDEO FORMAT:
   - Single shot, raw camera footage.
   - Vertical 9:16, full frame.
   - NO UI, NO subtitles.

*** OUTPUT ***
- JSON ONLY: {"prompt": "...", "script": "..."}
`;

const userPrompt = `
CONTEXT: ${concept}

OPENING FRAME RULE (ABSOLUTE):
- At time 0.0s, the video MUST already show a human presenter holding the exact product from the reference image.
- NO establishing shot.
- NO product-only frame.

SCENE REQUIREMENTS (STRICT):
- The video STARTS immediately with a human presenter.
- The product in hand MATCHES THE REFERENCE IMAGE EXACTLY (Digital Twin).
- The presenter looks at the camera and speaks Thai immediately.

SCRIPT (THAI – MUST FINISH WITHIN 8 SECONDS):
"${videoScriptInput.value}"

CHARACTER:
- ${gender}, ${nation} appearance
- Speaking naturally, confident, conversational Thai

ACTION:
- Holding the real product (Exact Match to Reference) clearly visible near the face.

BACKGROUND:
- ${background}

NEGATIVE PROMPT (MANDATORY):
NO first-frame still image, NO static opening frame, NO image-based first frame, NO product-only shots, NO cutaway shots, NO silent moments.
**CRITICAL NEGATIVE PROMPT (VISUALS):** distorted product, wrong product label, wrong color, morphed object, bad hands, black bars, letterbox, pillarbox, dark borders, screen margins, wide shot, distant subject, cartoon, 3d render.

The entire video must be one continuous shot of a person holding the product and speaking Thai clearly until the script ends.

GENERATE A LIVE-ACTION PROMPT:

2.  **Construct Scene:**
- **Camera:** **CLOSE-UP (Chest-up)**, Subject fills 90% of the vertical frame.
    - **Shot:** **Close-up / Tight Shot** (To ensure full screen & clear product).
    - **Subject:** A ${nationalitySelect.value} ${genderSelect.value} influencer.
    - **Audio:** Speaking Thai enthusiastically. Lips moving perfectly with the script.
    - **Action:** already present in frame at 00:00s in a ${bgSelect.value}, holding the real physical product (Identical to reference image) in hand.

**MANDATORY NEGATIVE PROMPT:**
"static image intro, slideshow, cover art, picture-in-picture, split screen, floating overlay, english audio, robotic voice, blurry text, black bars, letterboxing, pillarboxing, borders, frames, distorted product, wrong object".

**PROMPT START:**
"A vertical 9:16 live-action **Close-up Shot (frame-filling)** at 00:00s,
filling the vertical frame from top to bottom edge-to-edge,
with the presenter already present,
holding [INSERT A VERY DETAILED VISUAL DESCRIPTION OF THE PRODUCT FROM THE IMAGE HERE, describing its color, shape, material, and parts]
and speaking Thai directly to the camera..."

The entire video must be ONE continuous shot.
The presenter MUST finish speaking completely before the video ends.

GENERATE A LIVE-ACTION VIDEO PROMPT WITH CLEAR AUDIO AND LIP SYNC.
`;
// ==================================================================================
// --- จบส่วนที่แก้ไข (V18) ---
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
            try { 
                resultObj = JSON.parse(generatedText); 
                if (resultObj.script && resultObj.script !== videoScriptInput.value) {
                    videoScriptInput.value = resultObj.script; 
                }
            } catch {}

            // UI Display
            promptsContainer.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'prompt-card';
            
            card.innerHTML = `
                <div class="card-body">
                    <strong>Prompt (${currentMode}):</strong><br>${resultObj.prompt}
                    <br><br>
                    <strong>Script (Thai 8s):</strong> ${resultObj.script || '-'}
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
