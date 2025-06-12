// 钱包连接模块 - 处理浏览器钱包连接功能
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { uiManager } from './core/UIManager';

// 钱包连接状态
interface WalletState {
    connected: boolean;
    publicKey: PublicKey | null;
    address: string | null;
}

class WalletConnection {
    private wallet: any = null;
    private connection: Connection;
    private state: WalletState = {
        connected: false,
        publicKey: null,
        address: null
    };

    constructor() {
        // 连接到 Solana 主网 RPC
        this.connection = new Connection('https://api.mainnet-beta.solana.com');
        this.initializeWalletDetection();
    }

    // 初始化钱包检测
    private initializeWalletDetection() {
        // 检测页面加载时是否已有钱包连接
        if (typeof window !== 'undefined') {
            // 检测 Phantom 钱包
            if ('solana' in window) {
                this.wallet = (window as any).solana;
                if (this.wallet.isPhantom) {
                    console.log('检测到 Phantom 钱包');
                    this.checkAutoConnect();
                }
            }
            
            // 监听钱包事件
            this.setupEventListeners();
        }
    }

    // 设置事件监听器
    private setupEventListeners() {
        if (this.wallet) {
            // 监听账户变化
            this.wallet.on('accountChanged', (publicKey: PublicKey | null) => {
                if (publicKey) {
                    this.handleAccountChanged(publicKey);
                } else {
                    this.handleDisconnect();
                }
            });

            // 监听连接状态变化
            this.wallet.on('connect', (publicKey: PublicKey) => {
                this.handleConnect(publicKey);
            });

            this.wallet.on('disconnect', () => {
                this.handleDisconnect();
            });
        }
    }

    // 检查自动连接
    private async checkAutoConnect() {
        try {
            if (this.wallet && this.wallet.isConnected) {
                const publicKey = this.wallet.publicKey;
                if (publicKey) {
                    this.handleConnect(publicKey);
                }
            }
        } catch (error) {
            console.log('自动连接失败:', error);
        }
    }

    // 连接钱包
    async connect(): Promise<boolean> {
        try {
            if (!this.wallet) {
                // 如果没有检测到钱包，尝试重新检测
                await this.detectWallet();
                if (!this.wallet) {
                    throw new Error('未检测到支持的钱包，请安装 Phantom 或其他 Solana 钱包');
                }
            }

            const response = await this.wallet.connect();
            const publicKey = response.publicKey;
            
            if (publicKey) {
                this.handleConnect(publicKey);
                return true;
            }
            return false;
        } catch (error) {
            console.error('钱包连接失败:', error);
            uiManager.handleError(error, '钱包连接');
            return false;
        }
    }

    // 断开钱包连接
    async disconnect(): Promise<void> {
        try {
            if (this.wallet && this.wallet.isConnected) {
                await this.wallet.disconnect();
            }
            this.handleDisconnect();
        } catch (error) {
            console.error('断开连接失败:', error);
            // 即使断开失败，也要清理本地状态
            this.handleDisconnect();
        }
    }

    // 处理连接成功
    private handleConnect(publicKey: PublicKey) {
        this.state = {
            connected: true,
            publicKey: publicKey,
            address: publicKey.toString()
        };
        
        console.log('钱包连接成功:', this.state.address);
        this.updateUI();
        this.loadWalletBalance();
    }

    // 处理断开连接
    private handleDisconnect() {
        this.state = {
            connected: false,
            publicKey: null,
            address: null
        };
        
        console.log('钱包已断开连接');
        this.updateUI();
    }

    // 处理账户变化
    private handleAccountChanged(publicKey: PublicKey) {
        console.log('账户已切换:', publicKey.toString());
        this.handleConnect(publicKey);
    }

    // 检测钱包
    private async detectWallet(): Promise<void> {
        return new Promise((resolve) => {
            if ('solana' in window) {
                this.wallet = (window as any).solana;
                resolve();
                return;
            }

            // 等待钱包加载
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;
                if ('solana' in window) {
                    this.wallet = (window as any).solana;
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts > 50) { // 5秒超时
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    // 获取钱包余额
    private async loadWalletBalance() {
        if (!this.state.publicKey) return;

        try {
            const balance = await this.connection.getBalance(this.state.publicKey);
            const solBalance = balance / LAMPORTS_PER_SOL;
            console.log(`钱包余额: ${solBalance.toFixed(4)} SOL`);
            
            // 更新UI显示余额
            this.updateBalanceDisplay(solBalance);
        } catch (error) {
            console.error('获取余额失败:', error);
        }
    }

    // 更新UI
    private updateUI() {
        const connectBtn = document.getElementById('wallet-connect-btn') as HTMLButtonElement;
        const walletStatus = document.getElementById('wallet-status') as HTMLElement;
        const connectedAddress = document.getElementById('connected-address') as HTMLElement;
        const btnText = document.getElementById('wallet-btn-text') as HTMLElement;

        if (this.state.connected && this.state.address) {
            // 连接状态
            connectBtn.className = 'wallet-connect-btn wallet-disconnect-btn';
            connectBtn.innerHTML = '<span>🔌</span><span>断开连接</span>';
            
            walletStatus.style.display = 'flex';
            connectedAddress.textContent = this.formatAddress(this.state.address);
        } else {
            // 未连接状态
            connectBtn.className = 'wallet-connect-btn';
            connectBtn.innerHTML = '<span>🔗</span><span>连接钱包</span>';
            
            walletStatus.style.display = 'none';
        }
    }

    // 更新余额显示
    private updateBalanceDisplay(balance: number) {
        const balanceElement = document.getElementById('wallet-balance');
        if (balanceElement) {
            balanceElement.textContent = `${balance.toFixed(4)} SOL`;
        } else {
            // 如果余额元素不存在，创建一个
            const walletStatus = document.getElementById('wallet-status');
            if (walletStatus) {
                const balanceSpan = document.createElement('span');
                balanceSpan.id = 'wallet-balance';
                balanceSpan.textContent = `${balance.toFixed(4)} SOL`;
                balanceSpan.style.color = '#48bb78';
                balanceSpan.style.fontWeight = '500';
                walletStatus.appendChild(balanceSpan);
            }
        }
    }

    // 格式化地址显示
    private formatAddress(address: string): string {
        if (address.length <= 16) return address;
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }

    // 获取当前状态
    getState(): WalletState {
        return { ...this.state };
    }

    // 获取连接实例
    getConnection(): Connection {
        return this.connection;
    }

    // 签名交易
    async signTransaction(transaction: any) {
        if (!this.wallet || !this.state.connected) {
            throw new Error('钱包未连接');
        }
        return await this.wallet.signTransaction(transaction);
    }

    // 签名多个交易
    async signAllTransactions(transactions: any[]) {
        if (!this.wallet || !this.state.connected) {
            throw new Error('钱包未连接');
        }
        return await this.wallet.signAllTransactions(transactions);
    }

    // 签名消息
    async signMessage(message: Uint8Array) {
        if (!this.wallet || !this.state.connected) {
            throw new Error('钱包未连接');
        }
        return await this.wallet.signMessage(message);
    }
}

// 创建全局钱包连接实例
const walletConnection = new WalletConnection();

// 全局钱包连接切换函数
(window as any).toggleWalletConnection = async () => {
    const state = walletConnection.getState();
    
    if (state.connected) {
        await walletConnection.disconnect();
    } else {
        await walletConnection.connect();
    }
};

// 导出钱包连接实例供其他模块使用
(window as any).walletConnection = walletConnection;

export default walletConnection;
