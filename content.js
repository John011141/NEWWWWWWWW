// content.js - FINAL FIX: Target 'tune' icon & Force Vertical

// 1. แปลงไฟล์รูปภาพ
function base64ToFile(base64Data, mimeType, fileName) {
    try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new File([new Uint8Array(byteNumbers)], fileName, { type: mimeType });
    } catch (e) { console.error(e); return null; }
}

// 2. จำลองการลากไฟล์
function simulateDrop(element, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    ['dragenter', 'dragover', 'drop'].forEach(eventType => {
        element.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
}

// 3. Helper: รอเวลา
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 4. Helper: หา Element จากข้อความ
function findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
        if (el.innerText && el.innerText.includes(text)) return el;
    }
    return null;
}

// --- STEP 1: จัดการ Crop (เลือกแนวตั้ง + บันทึก) ---
async function handleCropAndSave() {
    console.log("Extension: Checking for Crop Modal...");
    for (let i = 0; i < 20; i++) { 
        const saveBtn = findElementByText('button', 'ครอบตัดและบันทึก') || 
                        findElementByText('button', 'Crop and save');
        
        if (saveBtn) {
            console.log("Extension: Crop Modal Detected!");
            
            // หาปุ่มแนวตั้งใน Crop
            const verticalBtn = findElementByText('button', 'แนวตั้ง') || 
                                findElementByText('span', 'แนวตั้ง') ||
                                document.querySelector('button[aria-label="Portrait"]');

            if (verticalBtn) {
                console.log("Extension: Clicking Vertical in Crop");
                verticalBtn.click();
                await sleep(1000); 
            }

            saveBtn.click();
            await sleep(2500); 
            return true;
        }
        await sleep(500);
    }
    return false;
}

// --- STEP 2: เปิดเมนูตั้งค่า (แก้ใหม่: เจาะจงปุ่ม 'tune') ---
async function openSettings() {
    console.log("Extension: Hunting for 'tune' Settings button...");
    
    // ค้นหาปุ่มทั้งหมดในหน้า
    const allButtons = Array.from(document.querySelectorAll('button'));
    
    // กรองหาปุ่มที่ใช่ที่สุด (จาก Screenshot ของคุณ)
    const settingsBtn = allButtons.find(btn => {
        // เช็ค 1: มี text ข้างในว่า "tune" (สำหรับไอคอน Material Symbols)
        const hasTuneText = btn.innerText.includes('tune');
        // เช็ค 2: มี text ว่า "การตั้งค่า" (อาจจะซ่อนอยู่)
        const hasSettingsText = btn.innerText.includes('การตั้งค่า') || btn.getAttribute('aria-label')?.includes('ตั้งค่า');
        // เช็ค 3: ต้องไม่ใช่ปุ่มที่ถูกปิด (disabled)
        const isEnabled = !btn.disabled;

        return (hasTuneText || hasSettingsText) && isEnabled;
    });

    if (settingsBtn) {
        console.log("Extension: Found Target Button! Clicking...", settingsBtn);
        settingsBtn.click();
        await sleep(1500); // รอเมนูเด้ง (สำคัญมาก)
        return true;
    }

    console.warn("Extension: Could not find Settings button (tune).");
    return false;
}

// --- STEP 3: ตั้งค่าเมนู (9:16 & 1 คลิป) ---
async function configureMenu() {
    console.log("Extension: Configuring Menu...");

    // 3.1 ปรับสัดส่วนเป็น 9:16
    // หา Label "สัดส่วนภาพ"
    const ratioLabel = findElementByText('div', 'สัดส่วนภาพ') || findElementByText('span', 'Aspect ratio');
    
    if (ratioLabel) {
        // หาปุ่ม Dropdown ที่อยู่ใกล้ๆ Label นี้
        // ปกติจะเป็น div ที่กดได้ หรือ button ที่มีข้อความเช่น "แนวนอน (16:9)" หรือ "16:9"
        const parentContainer = ratioLabel.closest('div').parentElement;
        const dropdownTriggers = parentContainer.querySelectorAll('div[role="button"], button');
        
        let targetTrigger = null;
        for (const t of dropdownTriggers) {
            // ปุ่มต้องไม่ใช่ตัว label เอง และต้องมีข้อความระบุค่าปัจจุบัน
            if (t !== ratioLabel && (t.innerText.includes('16:9') || t.innerText.includes('แนวนอน') || t.innerText.includes('Square'))) {
                targetTrigger = t;
                break;
            }
        }

        if (targetTrigger) {
            console.log("Extension: Opening Ratio Dropdown...");
            targetTrigger.click();
            await sleep(800);
            
            // หาตัวเลือก "แนวตั้ง (9:16)" ในลิสต์ที่เด้งออกมา
            const allOptions = document.querySelectorAll('li, div[role="option"], span');
            const verticalOption = Array.from(allOptions).find(el => el.innerText.includes('9:16') || el.innerText.includes('แนวตั้ง'));
            
            if (verticalOption) {
                console.log("Extension: Selecting 9:16...");
                verticalOption.click();
                await sleep(800);
            }
        }
    }

    // 3.2 ปรับจำนวนเป็น 1
    const countLabel = findElementByText('div', 'จำนวน') || findElementByText('span', 'Count');
    if (countLabel) {
        const parentContainer = countLabel.closest('div').parentElement;
        const dropdown = parentContainer.querySelector('div[role="button"], button');
        
        if (dropdown && !dropdown.innerText.includes('1')) {
            dropdown.click();
            await sleep(800);
            const allOptions = document.querySelectorAll('li, div[role="option"]');
            const oneOption = Array.from(allOptions).find(el => el.innerText.trim() === '1');
            if (oneOption) {
                oneOption.click();
                await sleep(800);
            }
        }
    }

    // ปิดเมนู (กด ESC)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(1000);
}

// --- STEP 4: กดส่ง (Smart Wait) ---
async function smartClickSend() {
    console.log("Extension: Waiting for Send button...");
    for (let i = 0; i < 20; i++) {
        const btns = Array.from(document.querySelectorAll('button'));
        // หาปุ่มส่ง: มีไอคอนลูกศร, ไม่อยู่ข้างบน, ไม่ใช่ปุ่ม + หรือ tune
        const sendBtn = btns.reverse().find(b => {
            const txt = b.innerHTML;
            const hasArrow = txt.includes('arrow') || (b.querySelector('svg') && !txt.includes('plus') && !txt.includes('tune'));
            const isVisible = b.offsetParent !== null;
            return hasArrow && isVisible;
        });

        if (sendBtn && !sendBtn.disabled) {
            console.log("Extension: Clicking Send!", sendBtn);
            sendBtn.click();
            return true;
        }
        await sleep(1000);
    }
    // สำรอง: กด Enter
    const input = document.querySelector('textarea');
    if(input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
}

// --- MAIN LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FILL_FLOW_PROMPT") {
        (async () => {
            const input = document.querySelector('textarea');
            if (!input) return;

            // 1. Upload
            if (request.imageData) {
                const file = base64ToFile(request.imageData, request.mimeType, "img.png");
                if (file) {
                    simulateDrop(input, file);
                    await handleCropAndSave();
                }
            }

            // 2. Settings (สำคัญ: รอให้หน้าเว็บนิ่งก่อนกด)
            await sleep(2000); 
            const opened = await openSettings();
            if (opened) {
                await configureMenu();
            }

            // 3. Prompt
            await sleep(500);
            input.value = request.prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // 4. Send
            await smartClickSend();
            
            sendResponse({ status: "success" });
        })();
        return true;
    }
});