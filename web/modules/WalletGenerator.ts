// 钱包生成功能模块
import {
    type WalletInfo,
    batchGenerateRandomWallets,
    batchGenerateFromMnemonic,
    batchGenerateWithUniqueMnemonics,
    validateMnemonic,
    generateMnemonic
} from '../../钱包管理/1.批量生成钱包';
import { appState, uiManager } from '../core/UIManager';

export class WalletGenerator {
    
    // 更新助记词输入框显示状态
    public updateMnemonicInput(): void {
        const walletType = (document.getElementById('walletType') as HTMLSelectElement).value;
        const mnemonicGroup = document.getElementById('mnemonicGroup')!;
        
        if (walletType === 'mnemonic') {
            mnemonicGroup.classList.remove('hidden');
        } else {
            mnemonicGroup.classList.add('hidden');
        }
    }
    
    // 生成钱包主函数
    public async generateWallets(): Promise<void> {
        try {
            const walletType = (document.getElementById('walletType') as HTMLSelectElement).value;
            const count = parseInt((document.getElementById('walletCount') as HTMLInputElement).value);
            const customMnemonic = (document.getElementById('customMnemonic') as HTMLInputElement).value.trim();
            
            if (count < 1 || count > 20) {
                uiManager.showInfo('请输入1-20之间的数量');
                return;
            }
            
            // 显示生成进度
            this.showGeneratingProgress(count);
            
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
                        uiManager.showInfo('输入的助记词格式不正确');
                        this.hideGeneratingProgress();
                        return;
                    }
                    wallets = batchGenerateFromMnemonic(mnemonic, count);
                    break;
                    
                case 'unique':
                    wallets = batchGenerateWithUniqueMnemonics(count);
                    break;
            }
            
            appState.generatedWallets = wallets;
            this.hideGeneratingProgress();
            this.displayResults(wallets);
            
        } catch (error) {
            console.error('生成钱包时出错:', error);
            this.hideGeneratingProgress();
            uiManager.handleError(error, '生成钱包');
        }
    }
    
    // 清空结果
    public clearResults(): void {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.classList.add('hidden');
        }
        appState.clearWallets();
    }
    
    // 导出结果
    public exportResults(): void {
        if (appState.generatedWallets.length === 0) {
            uiManager.showInfo('没有可导出的钱包数据');
            return;
        }
        
        const exportData = {
            generatedAt: new Date().toISOString(),
            totalWallets: appState.generatedWallets.length,
            wallets: appState.generatedWallets.map(wallet => ({
                index: wallet.index,
                publicKey: wallet.publicKey,
                mnemonic: wallet.mnemonic,
                privateKey: wallet.privateKey,
                privateKeyBase58: wallet.privateKeyBase58,
                derivationPath: wallet.derivationPath
            }))
        };
        
        const filename = uiManager.generateTimestampedFilename('solana-wallets');
        uiManager.downloadAsJson(exportData, filename);
    }
    
    // 显示生成进度
    private showGeneratingProgress(count: number): void {
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
    private hideGeneratingProgress(): void {
        // 进度会在displayResults中被替换，这里不需要特别处理
    }
    
    // 显示结果
    private displayResults(wallets: WalletInfo[]): void {
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
}

// 导出单例实例
export const walletGenerator = new WalletGenerator();
