// 主应用入口 - 简化版本
import { Buffer } from 'buffer';

// 设置 Buffer polyfill - 确保全局可用
if (typeof globalThis !== 'undefined') {
    globalThis.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
    (window as any).Buffer = Buffer;
}

// 导入模块
import './walletConnection';
import { uiManager } from './core/UIManager';
import { walletGenerator } from './modules/WalletGenerator';
import { balanceChecker } from './modules/BalanceChecker';
import walletConnection from './walletConnection';

// 全局函数类型声明
declare global {
    interface Window {
        uiManager: typeof uiManager; // 添加 uiManager 到 window 类型
        walletGenerator: typeof walletGenerator;
        balanceChecker: typeof balanceChecker;
        // 保留其他可能直接挂载到 window 的函数（如果需要的话）
        toggleModule?: (moduleId: string) => void;
        showSubmodule?: (moduleId: string, submoduleId: string) => void;
        generateWallets?: () => Promise<void>;
        copyToClipboard?: (elementId: string) => Promise<void>;
        clearResults?: () => void;
        exportResults?: () => void;
        queryWalletBalances?: () => Promise<void>;
        clearBalanceResults?: () => void;
        exportBalanceResults?: () => void;
    }
}

// 将核心对象挂载到 window，以便 HTML 直接调用
(window as any).uiManager = uiManager;
(window as any).walletGenerator = walletGenerator;
(window as any).balanceChecker = balanceChecker;
(window as any).walletConnection = walletConnection;

// 挂载常用函数到全局，保持向后兼容
(window as any).copyToClipboard = (elementId: string) => uiManager.copyToClipboard(elementId);

console.log('📋 核心模块已挂载到 window: uiManager, walletGenerator, balanceChecker');

// 应用初始化类
class App {
    private initialized = false;

    constructor() {
        // 使用已有的单例实例，不创建新实例
    }

    public init(): void {
        if (this.initialized) return;

        console.log("App initialize called");
        uiManager.initDOMReferences(); // 使用单例实例
        this.initializeUI();
        this.setupEventListeners();

        this.initialized = true;
        console.log('✅ Solana Scripts 应用初始化完成');
    }

    // 设置事件监听器
    private setupEventListeners(): void {
        // 钱包类型变化监听
        const walletTypeElement = document.getElementById('walletType') as HTMLSelectElement;
        if (walletTypeElement) {
            walletTypeElement.addEventListener('change', () => {
                walletGenerator.updateMnemonicInput();
            });
        }

        // 余额查询类型变化监听
        const balanceQueryTypeElement = document.getElementById('balanceQueryType') as HTMLSelectElement;
        if (balanceQueryTypeElement) {
            balanceQueryTypeElement.addEventListener('change', () => {
                balanceChecker.updateBalanceQueryUI();
            });
        }

        // 钱包连接按钮监听
        const walletConnectBtn = document.getElementById('wallet-connect-btn');
        if (walletConnectBtn) {
            walletConnectBtn.addEventListener('click', async () => {
                await walletConnection.connect();
            });
        }

        // 钱包断开按钮监听
        const walletDisconnectBtn = document.getElementById('wallet-disconnect-btn');
        if (walletDisconnectBtn) {
            walletDisconnectBtn.addEventListener('click', async () => {
                await walletConnection.disconnect();
            });
        }

        console.log('🔧 DOM事件监听器已设置');
    }

    // 初始化UI状态
    public initializeUI(): void {
        console.log("App initializeUI called");
        // Dynamically generate the navigation menu and workspaces
        uiManager.generateNavigationMenu();
        uiManager.generateWorkspaces();

        // 钱包连接会在其构造函数中自动初始化，这里不需要手动调用

        // Set the initial active module and submodule
        // Ensure this is called after dynamic generation
        const initialModule = 'wallet';
        const initialSubmodule = 'batch-generate';
        uiManager.showSubmodule(initialModule, initialSubmodule);
    }
}

// 创建并初始化应用
const app = new App();

// 立即初始化（确保函数可用）
app.init();

// DOM加载完成后再次初始化（确保DOM事件正常）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
