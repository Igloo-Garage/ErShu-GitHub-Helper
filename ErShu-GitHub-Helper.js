// ==UserScript==
// @name         二叔的GitHub下载助手 (v1.0初版)
// @namespace    
// @version      1.0
// @description  多AI模型切换、路牌、多重贴标、编译器识别、找同类软件。
// @author       二叔
// @match        https://github.com/Igloo-Garage/ErShu-GitHub-Helper/tree/main
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 配置：AI 模型列表
    // ==========================================
    const aiServices = {
        "kimi": { name: "🌙 Kimi (国内推荐)", type: "url", url: "https://kimi.moonshot.cn/chat?q=" },
        "chatgpt": { name: "🤖 ChatGPT (需魔法)", type: "url", url: "https://chatgpt.com/?q=" },
        "yuanbao": { name: "🐧 腾讯元宝", type: "paste", url: "https://yuanbao.tencent.com/chat" },
        "doubao": { name: "🥟 豆包", type: "paste", url: "https://www.doubao.com/chat/" },
        "gemini": { name: "✨ Gemini", type: "paste", url: "https://gemini.google.com/app" }
    };

    const rules = [
        // --- 1. 编译器 (最高优先级) ---
        { regex: /msvc/i, label: "🏆 Win官方标准版(MSVC)", color: "#0d6efd", icon: "💎" },
        { regex: /mingw/i, label: "🌐 跨平台(MinGW)", color: "#6610f2", icon: "⚙️" },

        // --- 2. 苹果 Mac 深度识别 (支持 .dmg 和 apple-darwin) ---
        { regex: /apple-darwin|macos|\.dmg$|\.pkg$/i, label: "🍎 Mac专用版", color: "#6f42c1", icon: "🍎" },
        // 专门针对苹果移动端应用的识别
        { regex: /\.ipa$/i, label: "🍎 iOS应用(IPA)", color: "#007aff", icon: "📱" },

        // --- 3. 系统识别 (针对 linux-gnu 等) ---
        { regex: /linux|ubuntu|debian|appimage|deb|rpm/i, label: "🐧 Linux版", color: "#fd7e14", icon: "🐧" },
        { regex: /android|\.apk$/i, label: "🤖 安卓应用", color: "#a4c639", icon: "📱" },

        // --- 4. 格式补全与源码 ---
        { regex: /\.msi$|\.exe$/i, label: "💿 Win程序", color: "#198754", icon: "💾" },
        { regex: /\.iso$|\.bin$|\.chd$|\.cue$|\.img$/i, label: "📀 光盘镜像", color: "#0dcaf0", icon: "💿" },
        { regex: /\.nsp$|\.xci$|\.gba$|\.nes$|\.sfc$/i, label: "🕹️ 游戏 ROM", color: "#ff5722", icon: "🎮" },
        { regex: /source.*code|src.*code/i, label: "🛠️ 源代码", color: "#d93f0b", icon: "💻" },
        // --- 5. 架构识别 (针对 aarch64 和 x64) ---
        { regex: /aarch64|arm64/i, label: "📱 ARM移动芯片", color: "#d63384", icon: "🚀" },
        { regex: /x86_64|amd64|x64/i, label: "💻 PC 64位", color: "#444", icon: "🖥️" },
        { regex: /x86|i386/i, label: "📟 PC 32位", color: "#6c757d", icon: "📟" },
        { regex: /\.tar\.gz$|\.7z$|\.zip$|\.rar$/i, label: "📦 压缩包", color: "#adb5bd", icon: "🤐" }
    ];

    // ==========================================
    // 2. 核心功能：AI 选择弹窗
    // ==========================================
    function showAISettings() {
        if (document.getElementById('es-ai-modal')) return;
        const overlay = document.createElement('div');
        overlay.id = 'es-ai-modal';
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;justify-content:center;align-items:center;";
        const modal = document.createElement('div');
        modal.style.cssText = "background:white;padding:20px;border-radius:10px;width:300px;box-shadow:0 4px 15px rgba(0,0,0,0.3);";
        modal.innerHTML = `<h3 style="margin-top:0;border-bottom:1px solid #eee;padding-bottom:10px;color:#333;">⚙️ 选择想用的 AI</h3>`;

        const currentKey = GM_getValue("preferred_ai", "kimi");
        for (const [key, service] of Object.entries(aiServices)) {
            const btn = document.createElement('div');
            const isSelected = (key === currentKey);
            btn.style.cssText = `padding:10px;margin:5px 0;cursor:pointer;border-radius:5px;border:1px solid ${isSelected ? '#198754' : '#eee'};background:${isSelected ? '#e8f5e9' : '#fff'};color:${isSelected ? '#198754' : '#333'}`;
            btn.innerHTML = `<b>${isSelected ? '✅' : '⬜'} ${service.name}</b>`;
            btn.onclick = () => { GM_setValue("preferred_ai", key); overlay.remove(); alert(`已切换为: ${service.name}`); };
            modal.appendChild(btn);
        }
        const closeBtn = document.createElement('button');
        closeBtn.innerText = "关闭";
        closeBtn.style.cssText = "margin-top:15px;width:100%;padding:8px;background:#6c757d;color:white;border:none;border-radius:5px;cursor:pointer;";
        closeBtn.onclick = () => overlay.remove();
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // ==========================================
    // 3. 页面增强功能
    // ==========================================
    let tooltip = null;

    function processLinks() {
        if (!tooltip && document.body) {
            tooltip = document.createElement('div');
            tooltip.style.cssText = `position:fixed;display:none;background:rgba(0,0,0,0.9);color:#fff;padding:10px;border-radius:6px;font-size:12px;z-index:99999;pointer-events:none;border:1px solid #444;`;
            document.body.appendChild(tooltip);
        }

        document.querySelectorAll('a[href]').forEach(link => {
            if (link.dataset.processed) return;

            const url = link.href;
            const linkText = (link.innerText || "").trim();
            const checkStr = (url + " " + linkText).toLowerCase();

            // --- 1. 核心改进：拦截校验文件（sha256/md5/asc等） ---
            const isCheckSum = checkStr.match(/\.(sha256|sha1|sha256sum|md5|asc|sig|sha512)$/i);

            // --- 2. 核心改进：设置“准入证”（只处理真正的资源文件） ---
            const isRes = !isCheckSum && (
                checkStr.match(/\.(exe|msi|apk|ipa|zip|7z|tar|gz|iso|bin|dmg|pkg|deb|rpm|appimage|chd|cue|img|nsp|xci|gba|nes|sfc)$/i) ||
                checkStr.includes('source code') ||
                url.includes('releases/download')
            );

            // 只有拿到了“准入证”，才开始贴标签
            if (isRes) {
                let badges = "";
                let count = 0; // --- 新增：标签计数器 ---

                rules.forEach(rule => {
                    // 只有在匹配成功，且当前标签数还没到 2 个时，才添加
                    if (count < 2 && rule.regex.test(checkStr)) {
                        badges += `<span style="font-size:12.5px;background:${rule.color};color:#fff;border-radius:4px;padding:2px 6px;margin-left:4px;font-weight:bold;display:inline-block;white-space:nowrap;line-height:1.2;">${rule.icon} ${rule.label}</span>`;
                        count++; // --- 每贴一个，计数加一 ---
                    }
                });

                if (badges) {
                    link.insertAdjacentHTML('afterend', badges);
                }

                // 鼠标悬停侦探功能
                link.addEventListener('mouseenter', (e) => {
                    tooltip.innerHTML = `📄 ${decodeURIComponent(url.split('/').pop().split('?')[0])}`;
                    tooltip.style.display = 'block';
                });
                link.addEventListener('mousemove', (e) => {
                    tooltip.style.top = (e.clientY + 15) + 'px';
                    tooltip.style.left = (e.clientX + 15) + 'px';
                });
                link.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
            }

            // 标记为已处理，防止无限循环
            link.dataset.processed = "true";
        });
    }

    function addNavigation() {
        const path = window.location.pathname;
        const parts = path.split('/');
        if (parts.length < 3) return;

        // 1. 找同类软件按钮 (保持150% 放大设置)
        const repoTitle = document.querySelector('strong[itemprop="name"] a') || document.querySelector('strong[itemprop="name"]');
        if (repoTitle && !document.getElementById('es-alt-btn')) {
            const btn = document.createElement('a');
            btn.id = 'es-alt-btn';
            btn.href = `https://alternativeto.net/software/${parts[2].toLowerCase()}/`;
            btn.target = "_blank";
            btn.innerHTML = "🔍 找同类软件";
            btn.style.cssText = "display:inline-flex;align-items:center;padding:5px 12px;margin-left:15px;font-size:18px;color:#d96d00;background:#fff8eb;border:2px solid #fbbf24;border-radius:20px;text-decoration:none;font-weight:bold;vertical-align:middle;box-shadow:0 2px 5px rgba(217,109,0,0.15);";
            repoTitle.parentNode.insertBefore(btn, repoTitle.nextSibling);
        }

        // 2. 粉色路牌 (专门适配 yt-dlp 等侧边栏不固定的项目)
        // 贴在 Releases 标题右侧
        if (!path.includes('/releases')) {
            const relLink = document.querySelector('a[href*="/releases"]');
            if (relLink && !document.getElementById('es-guide-btn')) {
                const guide = document.createElement('a'); // 改成 a 标签，更像个链接
                guide.id = "es-guide-btn";
                guide.href = `/${parts[1]}/${parts[2]}/releases`; // 直接写跳转地址
                guide.innerHTML = "▼ 点这里转到下载页面";

                // --- 样式微调 ---
                //
                guide.style.cssText = `
                    color: #d63384;
                    background: #ffe6f2;
                    border: 1px solid #d63384;
                    padding: 3px 10px;        /* 稍微加宽一点，撑起大字 */
                    border-radius: 12px;
                    margin-left: 8px;
                    font-size: 13.5px;         /* 放大 10% 以上，更显眼 */
                    text-decoration: none;
                    font-weight: bold;
                    display: inline-block;
                    vertical-align: middle;
                    box-shadow: 1px 1px 3px rgba(214, 51, 132, 0.2); /* 加一点点阴影更有立体感 */
                `;

                // --- 关键定位：插在 Releases 标题的右边 ---
                const releaseTitle = document.querySelector('.Layout-sidebar h2 a[href*="/releases"]');
                if (releaseTitle) {
                    // 直接插在标题文字的后面
                    releaseTitle.after(guide);
                } else {
                    // 兜底：如果没找到标题，就插在原链接后面
                    relLink.after(guide);
                }
            }
        }
    } // <--- 这个大括号，它必须对应 function 开启的地方

    function addAI() {
        document.querySelectorAll('.Box, .release-entry, section[aria-labelledby]').forEach(box => {
            if (box.dataset.ai_done) return;
            const header = box.querySelector('h1, h2, .f1, .markdown-title');
            if (header) {
                // 1. 调整外层容器，增加右边距，拉开与 Compare 菜单的距离
                const group = document.createElement('div');
                group.style.cssText = "float:right; display:flex; gap:8px; margin-right:15px; align-items:center;";

                // 2. ⚙️ 设置按钮 (放大 10%)
                const setBtn = document.createElement('button');
                setBtn.innerHTML = "⚙️";
                setBtn.style.cssText = "font-size:13px; background:#f6f8fa; border:1px solid #d0d7de; padding:4px 7px; border-radius:4px; cursor:pointer;";
                setBtn.onclick = (e) => { e.preventDefault(); showAISettings(); };

                // 3. 🤖 问AI按钮 (放大 10% + 更有质感的内边距)
                const aiBtn = document.createElement('button');
                aiBtn.innerHTML = "🤖 问AI";
                aiBtn.style.cssText = "font-size:13px; background:#2da44e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-weight:bold;";

                aiBtn.onclick = (e) => {
                    e.preventDefault();

                    // 1. 获取全文并截断 Assets 之后的内容
                    let fullText = box.innerText;
                    const assetsIndex = fullText.search(/Assets/i);
                    if (assetsIndex !== -1) {
                        fullText = fullText.substring(0, assetsIndex);
                    }

                    // 2. 清理空白， 对2500 字总结
                    const cleanText = fullText.replace(/\s+/g, ' ').trim();
                    const prompt = `我是普通用户，请用8句大白话总结这个版本的更新核心，忽略文件列表和技术术语：\n\n${cleanText.substring(0, 2500)}`;

                    // 3. 读取配置，默认设为 chatgpt
                    const serviceKey = GM_getValue("preferred_ai", "chatgpt");
                    const service = aiServices[serviceKey];

                    // 4. 执行跳转或复制
                    GM_setClipboard(prompt);

                    if (serviceKey === "chatgpt") {
                        // ChatGPT 尝试带参数跳转
                        GM_openInTab(service.url + encodeURIComponent(prompt), { active: true });
                    } else {
                        // 其他模型（如 Kimi）提示手动粘贴
                        alert(`✅ 更新日志已抓取！\n\n跳转到 ${service.name} 后，直接 Ctrl+V【粘贴】即可。`);
                        GM_openInTab(service.url, { active: true });
                    }
                };

                group.appendChild(setBtn);
                group.appendChild(aiBtn);
                header.appendChild(group);
            }
            box.dataset.ai_done = "true";
        });
    }

    function main() {
        processLinks();
        addNavigation();
        addAI();
    }

    setInterval(main, 1500);
    document.addEventListener('turbo:load', main);

})();
