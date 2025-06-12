// 导入 Buffer polyfill
import { Buffer } from 'buffer';

// 直接在全局设置 Buffer
(window as any).Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

// 导入钱包连接模块
import './walletConnection';

// 直接导入钱包管理文件夹中的TypeScript函数
import { 
    type WalletInfo,
    generateRandomWallet,
    generateWalletFromMnemonic,
    batchGenerateRandomWallets,
    batchGenerateFromMnemonic,
    batchGenerateWithUniqueMnemonics,
    validateMnemonic,
    generateMnemonic
} from '../钱包管理/1.批量生成钱包';

// 全局变量类型声明
declare global {
    interface Window {
        toggleModule: (moduleId: string) => void;
        showSubmodule: (moduleId: string, submoduleId: string) => void;
        generateWallets: () => Promise<void>;
        copyToClipboard: (elementId: string) => Promise<void>;
        clearResults: () => void;
        exportResults: () => void;
    }
}

// UI 相关函数
let currentModule = 'wallet';
let currentSubmodule = 'batch-generate';
let generatedWallets: WalletInfo[] = [];

// 模块配置
const moduleConfig = {
    'wallet': {
        'batch-generate': {
            title: '批量生成钱包',
            subtitle: '快速批量生成 Solana 钱包，支持多种生成模式'
        },
        'import-export': {
            title: '导入导出钱包',
            subtitle: '导入现有钱包或导出钱包信息'
        },
        'balance-check': {
            title: '余额查询',
            subtitle: '查询钱包的 SOL 和代币余额'
        }
    },
    'token': {
        'create': {
            title: '创建代币',
            subtitle: '在 Solana 网络上创建新的 SPL 代币'
        },
        'transfer': {
            title: '代币转账',
            subtitle: '发送 SPL 代币到其他钱包地址'
        },
        'mint': {
            title: '代币铸造',
            subtitle: '为现有代币铸造新的供应量'
        }
    },
    'nft': {
        'mint': {
            title: '铸造 NFT',
            subtitle: '创建和铸造 Solana NFT'
        },
        'transfer': {
            title: '转移 NFT',
            subtitle: '将 NFT 转移到其他钱包'
        },
        'metadata': {
            title: '元数据管理',
            subtitle: '管理 NFT 的元数据信息'
        }
    },
    'transaction': {
        'history': {
            title: '交易历史',
            subtitle: '查看钱包的交易记录'
        },
        'batch': {
            title: '批量交易',
            subtitle: '执行批量转账操作'
        }
    }
};

// 切换模块折叠状态
function toggleModule(moduleId: string) {
    const submenu = document.getElementById(`${moduleId}-submenu`);
    const arrow = document.getElementById(`${moduleId}-arrow`);
    const moduleHeader = document.querySelector(`#${moduleId}-arrow`)?.parentElement;
    
    if (!submenu || !arrow || !moduleHeader) return;
    
    if (submenu.classList.contains('expanded')) {
        submenu.classList.remove('expanded');
        arrow.classList.remove('expanded');
        if (currentModule === moduleId) {
            moduleHeader.classList.remove('active');
        }
    } else {
        // 先关闭其他模块
        document.querySelectorAll('.nav-submenu').forEach(menu => {
            menu.classList.remove('expanded');
        });
        document.querySelectorAll('.nav-module-arrow').forEach(arr => {
            arr.classList.remove('expanded');
        });
        document.querySelectorAll('.nav-module-header').forEach(header => {
            header.classList.remove('active');
        });
        
        // 打开当前模块
        submenu.classList.add('expanded');
        arrow.classList.add('expanded');
        moduleHeader.classList.add('active');
        
        // 如果切换到不同模块，显示第一个子模块
        if (currentModule !== moduleId) {
            const firstSubmodule = submenu.querySelector('.nav-submodule');
            if (firstSubmodule) {
                const onclickAttr = firstSubmodule.getAttribute('onclick');
                if (onclickAttr) {
                    const matches = onclickAttr.match(/'([^']*)'.*'([^']*)'/);
                    if (matches && matches[2]) {
                        showSubmodule(moduleId, matches[2]);
                    }
                }
            }
        }
    }
}

// 显示子模块
function showSubmodule(moduleId: string, submoduleId: string) {
    currentModule = moduleId;
    currentSubmodule = submoduleId;
    
    // 更新导航状态
    document.querySelectorAll('.nav-submodule').forEach(item => {
        item.classList.remove('active');
    });
    
    // 找到并激活当前子模块
    const targetSubmodule = document.querySelector(`[onclick*="'${moduleId}'"][onclick*="'${submoduleId}'"]`);
    if (targetSubmodule) {
        targetSubmodule.classList.add('active');
    }
    
    // 更新内容标题
    const config = moduleConfig[moduleId]?.[submoduleId];
    if (config) {
        const titleElement = document.getElementById('content-title');
        const subtitleElement = document.getElementById('content-subtitle');
        if (titleElement) titleElement.textContent = config.title;
        if (subtitleElement) subtitleElement.textContent = config.subtitle;
    }
    
    // 隐藏所有工作区
    document.querySelectorAll('[id$="-workspace"]').forEach(workspace => {
        workspace.classList.add('hidden');
    });
    
    // 显示对应的工作区
    const workspaceId = `${moduleId}-${submoduleId}-workspace`;
    const workspace = document.getElementById(workspaceId);
    if (workspace) {
        workspace.classList.remove('hidden');
    }
    
    // 确保模块是展开的
    const submenu = document.getElementById(`${moduleId}-submenu`);
    const arrow = document.getElementById(`${moduleId}-arrow`);
    const moduleHeader = arrow?.parentElement;
    
    if (submenu && arrow && moduleHeader && !submenu.classList.contains('expanded')) {
        submenu.classList.add('expanded');
        arrow.classList.add('expanded');
        moduleHeader.classList.add('active');
    }
}

// 更新助记词输入框显示状态
function updateMnemonicInput() {
    const walletType = (document.getElementById('walletType') as HTMLSelectElement).value;
    const mnemonicGroup = document.getElementById('mnemonicGroup')!;
    
    if (walletType === 'mnemonic') {
        mnemonicGroup.classList.remove('hidden');
    } else {
        mnemonicGroup.classList.add('hidden');
    }
}

// 生成钱包
async function generateWallets() {
    try {
        const walletType = (document.getElementById('walletType') as HTMLSelectElement).value;
        const count = parseInt((document.getElementById('walletCount') as HTMLInputElement).value);
        const customMnemonic = (document.getElementById('customMnemonic') as HTMLInputElement).value.trim();
        
        if (count < 1 || count > 20) {
            alert('请输入1-20之间的数量');
            return;
        }
        
        // 显示生成进度
        showGeneratingProgress(count);
        
        let wallets: WalletInfo[] = [];
        
        switch (walletType) {
            case 'random':
                wallets = batchGenerateRandomWallets(count);
                break;
                
            case 'mnemonic':
                let mnemonic = customMnemonic;
                if (!mnemonic) {
                    mnemonic = generateMnemonic();
                } else if (!validateMnemonic(mnemonic)) {
                    alert('输入的助记词格式不正确');
                    hideGeneratingProgress();
                    return;
                }
                wallets = batchGenerateFromMnemonic(mnemonic, count);
                break;
                
            case 'unique':
                wallets = batchGenerateWithUniqueMnemonics(count);
                break;
        }
        
        generatedWallets = wallets;
        hideGeneratingProgress();
        displayResults(wallets);
        
    } catch (error) {
        console.error('生成钱包时出错:', error);
        hideGeneratingProgress();
        alert('生成钱包时出错: ' + error.message);
    }
}

// 显示生成进度
function showGeneratingProgress(count: number) {
    const resultsDiv = document.getElementById('results')!;
    const walletResultsDiv = document.getElementById('walletResults')!;
    
    walletResultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 2rem; margin-bottom: 20px;">🔄</div>
            <h3 style="color: #4a5568; margin-bottom: 10px;">正在生成钱包...</h3>
            <p style="color: #718096;">预计生成 ${count} 个钱包</p>
            <div style="width: 100%; background: #e2e8f0; border-radius: 10px; margin-top: 20px; height: 8px;">
                <div style="width: 0%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; border-radius: 10px; animation: loading 2s ease-in-out infinite;"></div>
            </div>
        </div>
        <style>
            @keyframes loading {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 100%; }
            }
        </style>
    `;
    resultsDiv.classList.remove('hidden');
}

// 隐藏生成进度
function hideGeneratingProgress() {
    // 进度会在displayResults中被替换，这里不需要特别处理
}

// 显示结果
function displayResults(wallets: WalletInfo[]) {
    const resultsDiv = document.getElementById('results')!;
    const walletResultsDiv = document.getElementById('walletResults')!;
    
    if (wallets.length === 0) {
        resultsDiv.classList.add('hidden');
        return;
    }
    
    let html = `<div class="success-banner">
        ✅ 成功生成 ${wallets.length} 个钱包
    </div>`;
    
    wallets.forEach((wallet, index) => {
        html += `
            <div class="wallet-item">
                <h4>💰 钱包 #${wallet.index}</h4>
                <div class="wallet-field">
                    <strong>地址:</strong>
                    <span class="wallet-field-content" id="address-${index}">${wallet.publicKey}</span>
                    <button class="copy-btn" onclick="copyToClipboard('address-${index}')">复制</button>
                </div>
                ${wallet.mnemonic ? `
                <div class="wallet-field">
                    <strong>助记词:</strong>
                    <span class="wallet-field-content" id="mnemonic-${index}">${wallet.mnemonic}</span>
                    <button class="copy-btn" onclick="copyToClipboard('mnemonic-${index}')">复制</button>
                </div>
                ` : ''}
                <div class="wallet-field">
                    <strong>私钥数组:</strong>
                    <span class="wallet-field-content" id="privatekey-${index}">[${wallet.privateKey.join(', ')}]</span>
                    <button class="copy-btn" onclick="copyToClipboard('privatekey-${index}')">复制</button>
                </div>
                <div class="wallet-field">
                    <strong>私钥Base58:</strong>
                    <span class="wallet-field-content" id="base58-${index}">${wallet.privateKeyBase58}</span>
                    <button class="copy-btn" onclick="copyToClipboard('base58-${index}')">复制</button>
                </div>
            </div>
        `;
    });
    
    walletResultsDiv.innerHTML = html;
    resultsDiv.classList.remove('hidden');
    
    // 添加生成统计信息
    console.log(`🎉 成功生成 ${wallets.length} 个钱包`);
    wallets.forEach((wallet, index) => {
        console.log(`钱包 ${index + 1}: ${wallet.publicKey}`);
    });
    
    // 滚动到结果区域
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// 复制到剪贴板
async function copyToClipboard(elementId: string) {
    try {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const text = element.textContent || '';
        await navigator.clipboard.writeText(text);
        
        // 显示复制成功的反馈
        const button = element.nextElementSibling as HTMLButtonElement;
        if (button && button.tagName === 'BUTTON') {
            const originalText = button.textContent;
            button.textContent = '已复制!';
            button.style.background = '#48bb78';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '#667eea';
            }, 1000);
        }
        
    } catch (error) {
        console.error('复制失败:', error);
        alert('复制失败，请手动选择文本复制');
    }
}

// 清空结果
function clearResults() {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.classList.add('hidden');
    }
    generatedWallets = [];
}

// 导出结果
function exportResults() {
    if (generatedWallets.length === 0) {
        alert('没有可导出的钱包数据');
        return;
    }
    
    const exportData = {
        generatedAt: new Date().toISOString(),
        totalWallets: generatedWallets.length,
        wallets: generatedWallets.map(wallet => ({
            index: wallet.index,
            publicKey: wallet.publicKey,
            mnemonic: wallet.mnemonic,
            privateKey: wallet.privateKey,
            privateKeyBase58: wallet.privateKeyBase58,
            derivationPath: wallet.derivationPath
        }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `solana-wallets-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 立即将函数绑定到全局window对象，确保HTML可以访问
Object.assign(window, {
    toggleModule,
    showSubmodule,
    generateWallets,
    copyToClipboard,
    clearResults,
    exportResults
});

// 调试：验证函数已正确绑定
console.log('Functions bound to window:', {
    toggleModule: typeof window.toggleModule,
    showSubmodule: typeof window.showSubmodule,
    generateWallets: typeof window.generateWallets,
    copyToClipboard: typeof window.copyToClipboard,
    clearResults: typeof window.clearResults,
    exportResults: typeof window.exportResults
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 再次确保函数已绑定到window对象
    (window as any).toggleModule = toggleModule;
    (window as any).showSubmodule = showSubmodule;
    (window as any).generateWallets = generateWallets;
    (window as any).copyToClipboard = copyToClipboard;
    (window as any).clearResults = clearResults;
    (window as any).exportResults = exportResults;
    
    // 监听钱包类型变化
    const walletTypeElement = document.getElementById('walletType') as HTMLSelectElement;
    if (walletTypeElement) {
        walletTypeElement.addEventListener('change', updateMnemonicInput);
    }
    
    // 初始化显示状态
    updateMnemonicInput();
    
    // 默认展开钱包管理模块并显示批量生成
    toggleModule('wallet');
    showSubmodule('wallet', 'batch-generate');
});
