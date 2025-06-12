import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

// 钱包信息接口
class WalletInfo {
    constructor(index, publicKey, privateKey, privateKeyBase58, mnemonic = null, derivationPath = null) {
        this.index = index;
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.privateKeyBase58 = privateKeyBase58;
        this.mnemonic = mnemonic;
        this.derivationPath = derivationPath;
    }
}

// 生成随机钱包
function generateRandomWallet(index) {
    const keypair = Keypair.generate();
    
    return new WalletInfo(
        index,
        keypair.publicKey.toBase58(),
        Array.from(keypair.secretKey),
        bs58.encode(Buffer.from(keypair.secretKey))
    );
}

// 从助记词生成钱包
function generateWalletFromMnemonic(mnemonic, accountIndex = 0) {
    const derivationPath = `m/44'/501'/${accountIndex}'/0'`;
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);
    
    return new WalletInfo(
        accountIndex,
        keypair.publicKey.toBase58(),
        Array.from(keypair.secretKey),
        bs58.encode(Buffer.from(keypair.secretKey)),
        mnemonic,
        derivationPath
    );
}

// 批量生成随机钱包
function batchGenerateRandomWallets(count) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
        const wallet = generateRandomWallet(i + 1);
        wallets.push(wallet);
    }
    return wallets;
}

// 从单个助记词批量生成钱包
function batchGenerateFromMnemonic(mnemonic, count) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
        const wallet = generateWalletFromMnemonic(mnemonic, i);
        wallets.push(wallet);
    }
    return wallets;
}

// 批量生成带独立助记词的钱包
function batchGenerateWithUniqueMnemonics(count) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
        const mnemonic = bip39.generateMnemonic();
        const wallet = generateWalletFromMnemonic(mnemonic, 0);
        wallet.index = i + 1;
        wallets.push(wallet);
    }
    return wallets;
}

// UI 相关函数
let currentModule = 'wallet';
let currentSubmodule = 'batch-generate';
let generatedWallets = [];

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
function toggleModule(moduleId) {
    const submenu = document.getElementById(`${moduleId}-submenu`);
    const arrow = document.getElementById(`${moduleId}-arrow`);
    const moduleHeader = document.querySelector(`#${moduleId}-arrow`).parentElement;
    
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
                const submoduleId = firstSubmodule.getAttribute('onclick').match(/'([^']*)'.*'([^']*)'/)[2];
                showSubmodule(moduleId, submoduleId);
            }
        }
    }
}

// 显示子模块
function showSubmodule(moduleId, submoduleId) {
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
        document.getElementById('content-title').textContent = config.title;
        document.getElementById('content-subtitle').textContent = config.subtitle;
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
    const moduleHeader = arrow.parentElement;
    
    if (!submenu.classList.contains('expanded')) {
        submenu.classList.add('expanded');
        arrow.classList.add('expanded');
        moduleHeader.classList.add('active');
    }
}

// 更新助记词输入框显示状态
function updateMnemonicInput() {
    const walletType = document.getElementById('walletType').value;
    const mnemonicGroup = document.getElementById('mnemonicGroup');
    
    if (walletType === 'mnemonic') {
        mnemonicGroup.classList.remove('hidden');
    } else {
        mnemonicGroup.classList.add('hidden');
    }
}

// 生成钱包
async function generateWallets() {
    try {
        const walletType = document.getElementById('walletType').value;
        const count = parseInt(document.getElementById('walletCount').value);
        const customMnemonic = document.getElementById('customMnemonic').value.trim();
        
        if (count < 1 || count > 20) {
            alert('请输入1-20之间的数量');
            return;
        }
        
        let wallets = [];
        
        switch (walletType) {
            case 'random':
                wallets = batchGenerateRandomWallets(count);
                break;
                
            case 'mnemonic':
                let mnemonic = customMnemonic;
                if (!mnemonic) {
                    mnemonic = bip39.generateMnemonic();
                } else if (!bip39.validateMnemonic(mnemonic)) {
                    alert('输入的助记词格式不正确');
                    return;
                }
                wallets = batchGenerateFromMnemonic(mnemonic, count);
                break;
                
            case 'unique':
                wallets = batchGenerateWithUniqueMnemonics(count);
                break;
        }
        
        generatedWallets = wallets;
        displayResults(wallets);
        
    } catch (error) {
        console.error('生成钱包时出错:', error);
        alert('生成钱包时出错: ' + error.message);
    }
}

// 显示结果
function displayResults(wallets) {
    const resultsDiv = document.getElementById('results');
    const walletResultsDiv = document.getElementById('walletResults');
    
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
                    <div class="wallet-field-content" id="address-${index}">${wallet.publicKey}</div>
                    <button class="copy-btn" onclick="copyToClipboard('address-${index}')">复制</button>
                </div>
                ${wallet.mnemonic ? `
                <div class="wallet-field">
                    <strong>助记词:</strong>
                    <div class="wallet-field-content" id="mnemonic-${index}">${wallet.mnemonic}</div>
                    <button class="copy-btn" onclick="copyToClipboard('mnemonic-${index}')">复制</button>
                </div>
                ` : ''}
                <div class="wallet-field">
                    <strong>私钥数组:</strong>
                    <div class="wallet-field-content" id="privatekey-${index}">[${wallet.privateKey.join(', ')}]</div>
                    <button class="copy-btn" onclick="copyToClipboard('privatekey-${index}')">复制</button>
                </div>
                <div class="wallet-field">
                    <strong>私钥Base58:</strong>
                    <div class="wallet-field-content" id="base58-${index}">${wallet.privateKeyBase58}</div>
                    <button class="copy-btn" onclick="copyToClipboard('base58-${index}')">复制</button>
                </div>
            </div>
        `;
    });
    
    walletResultsDiv.innerHTML = html;
    resultsDiv.classList.remove('hidden');
    
    // 滚动到结果区域
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// 复制到剪贴板
async function copyToClipboard(elementId) {
    try {
        const element = document.getElementById(elementId);
        const text = element.textContent;
        await navigator.clipboard.writeText(text);
        
        // 显示复制成功的反馈
        const button = element.nextElementSibling;
        const originalText = button.textContent;
        button.textContent = '已复制!';
        button.style.background = '#48bb78';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#48bb78';
        }, 1000);
        
    } catch (error) {
        console.error('复制失败:', error);
        alert('复制失败，请手动选择文本复制');
    }
}

// 清空结果
function clearResults() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.classList.add('hidden');
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

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 监听钱包类型变化
    document.getElementById('walletType').addEventListener('change', updateMnemonicInput);
    
    // 初始化显示状态
    updateMnemonicInput();
    
    // 默认展开钱包管理模块并显示批量生成
    toggleModule('wallet');
    showSubmodule('wallet', 'batch-generate');
});

// 导出全局函数供HTML调用
window.toggleModule = toggleModule;
window.showSubmodule = showSubmodule;
window.generateWallets = generateWallets;
window.copyToClipboard = copyToClipboard;
window.clearResults = clearResults;
window.exportResults = exportResults;
