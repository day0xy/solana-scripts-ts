// 余额查询功能模块
import {
    getWalletBalance,
    batchGetWalletBalance
} from '../../钱包管理/2.余额查询';
import { appState, uiManager } from '../core/UIManager';

export class BalanceChecker {
    
    // 更新查询类型显示
    public updateBalanceQueryUI(): void {
        const queryType = (document.getElementById('balanceQueryType') as HTMLSelectElement)?.value;
        
        // 隐藏所有输入组
        const groups = ['singleWalletGroup', 'batchWalletGroup'];
        groups.forEach(groupId => {
            const group = document.getElementById(groupId);
            if (group) group.classList.add('hidden');
        });
        
        // 显示对应的输入组
        switch (queryType) {
            case 'single':
                document.getElementById('singleWalletGroup')?.classList.remove('hidden');
                break;
            case 'batch':
                document.getElementById('batchWalletGroup')?.classList.remove('hidden');
                break;
        }
    }
    
    // 查询钱包余额主函数
    public async queryWalletBalances(): Promise<void> {
        const queryType = (document.getElementById('balanceQueryType') as HTMLSelectElement)?.value;
        
        try {
            // 显示加载状态
            this.showBalanceLoading();
            
            let results: { [address: string]: number | null } = {};
            
            switch (queryType) {
                case 'single':
                    results = await this.querySingleWallet();
                    break;
                case 'batch':
                    results = await this.queryBatchWallets();
                    break;
            }
            
            appState.balanceResults = results;
            this.displayBalanceResults(results);
            
        } catch (error) {
            console.error('查询余额失败:', error);
            uiManager.handleError(error, '查询余额');
            this.hideBalanceLoading();
        }
    }
    
    // 清空余额查询结果
    public clearBalanceResults(): void {
        const resultsDiv = document.getElementById('balanceResults');
        if (resultsDiv) {
            resultsDiv.classList.add('hidden');
        }
        appState.clearBalances();
    }
    
    // 导出余额查询结果
    public exportBalanceResults(): void {
        if (Object.keys(appState.balanceResults).length === 0) {
            uiManager.showInfo('没有可导出的余额数据');
            return;
        }
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            totalWallets: Object.keys(appState.balanceResults).length,
            successfulQueries: Object.values(appState.balanceResults).filter(v => v !== null).length,
            failedQueries: Object.values(appState.balanceResults).filter(v => v === null).length,
            totalBalance: Object.values(appState.balanceResults)
                .filter(v => v !== null)
                .reduce((sum, balance) => sum + (balance || 0), 0),
            wallets: Object.entries(appState.balanceResults).map(([address, balance], index) => ({
                index: index + 1,
                address,
                balance,
                isValid: balance !== null
            }))
        };
        
        const filename = uiManager.generateTimestampedFilename('solana-balance-query');
        uiManager.downloadAsJson(exportData, filename);
    }
    
    // 查询单个钱包
    private async querySingleWallet(): Promise<{ [address: string]: number | null }> {
        const address = (document.getElementById('singleWalletAddress') as HTMLInputElement)?.value?.trim();
        
        if (!address) {
            throw new Error('请输入钱包地址');
        }
        
        try {
            const balance = await getWalletBalance(address);
            return { [address]: balance };
        } catch (error) {
            return { [address]: null };
        }
    }
    
    // 批量查询钱包
    private async queryBatchWallets(): Promise<{ [address: string]: number | null }> {
        const addressesText = (document.getElementById('batchWalletAddresses') as HTMLTextAreaElement)?.value?.trim();
        
        if (!addressesText) {
            throw new Error('请输入钱包地址列表');
        }
        
        // 解析地址列表
        const addresses = addressesText
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0);
        
        if (addresses.length === 0) {
            throw new Error('没有有效的钱包地址');
        }
        
        return await batchGetWalletBalance(addresses, 3);
    }
    
    // 显示加载状态
    private showBalanceLoading(): void {
        const resultsDiv = document.getElementById('balanceResults');
        if (resultsDiv) {
            resultsDiv.classList.remove('hidden');
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <div style="font-size: 1.2rem; margin-bottom: 12px;">⏳ 正在查询余额...</div>
                    <p>请稍候，正在获取钱包余额信息</p>
                </div>
            `;
        }
    }
    
    // 隐藏加载状态
    private hideBalanceLoading(): void {
        const resultsDiv = document.getElementById('balanceResults');
        if (resultsDiv) {
            resultsDiv.classList.add('hidden');
        }
    }
    
    // 显示余额查询结果
    private displayBalanceResults(results: { [address: string]: number | null }): void {
        const resultsDiv = document.getElementById('balanceResults');
        if (!resultsDiv) return;
        
        // 计算统计信息
        const addresses = Object.keys(results);
        const total = addresses.length;
        const successful = Object.values(results).filter(v => v !== null).length;
        const failed = total - successful;
        const totalBalance = Object.values(results)
            .filter(v => v !== null)
            .reduce((sum, balance) => sum + (balance || 0), 0);
        
        // 生成结果HTML
        let html = `
            <h3>📊 查询结果</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div style="padding: 16px; background: #f7fafc; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #2d3748;">${total}</div>
                    <div style="color: #718096; font-size: 0.9rem;">总钱包数</div>
                </div>
                <div style="padding: 16px; background: #f0fff4; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #38a169;">${successful}</div>
                    <div style="color: #718096; font-size: 0.9rem;">查询成功</div>
                </div>
                <div style="padding: 16px; background: #fed7d7; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #e53e3e;">${failed}</div>
                    <div style="color: #718096; font-size: 0.9rem;">查询失败</div>
                </div>
                <div style="padding: 16px; background: #bee3f8; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #3182ce;">${totalBalance.toFixed(4)}</div>
                    <div style="color: #718096; font-size: 0.9rem;">总余额 (SOL)</div>
                </div>
            </div>
            <div>
        `;
        
        // 生成详细列表
        addresses.forEach((address, index) => {
            const balance = results[address];
            const statusIcon = balance !== null ? '✅' : '❌';
            const statusColor = balance !== null ? '#48bb78' : '#e53e3e';
            const balanceText = balance !== null ? balance.toFixed(4) : '0.0000';
            
            html += `
                <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 500; color: #2d3748;">钱包 #${index + 1}</span>
                        <span style="color: ${statusColor}; font-weight: 500;">${statusIcon} ${balance !== null ? '成功' : '失败'}</span>
                    </div>
                    
                    <div class="wallet-field">
                        <span class="field-label">地址:</span>
                        <div class="field-value-container">
                            <span class="field-value" style="font-family: 'Courier New', monospace;">${address}</span>
                            <button class="copy-btn" onclick="copyToClipboard('balance-address-${index}')">复制</button>
                        </div>
                        <input type="hidden" id="balance-address-${index}" value="${address}">
                    </div>
                    
                    <div class="wallet-field">
                        <span class="field-label">余额:</span>
                        <div class="field-value-container">
                            <span class="field-value" style="color: #48bb78; font-weight: 500;">${balanceText} SOL</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
    }
}

// 导出单例实例
export const balanceChecker = new BalanceChecker();
