// 核心UI管理模块
import { WalletInfo } from '../../钱包管理/1.批量生成钱包';

// 模块配置接口
export interface ModuleConfig {
    title: string;
    subtitle: string;
}

// 全局状态管理
export class AppState {
    private static instance: AppState;
    
    public currentModule = 'wallet';
    public currentSubmodule = 'batch-generate';
    public generatedWallets: WalletInfo[] = [];
    public balanceResults: { [address: string]: number | null } = {};
    
    private constructor() {}
    
    public static getInstance(): AppState {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }
    
    public clearWallets() {
        this.generatedWallets = [];
    }
    
    public clearBalances() {
        this.balanceResults = {};
    }
}

// 模块配置
export const moduleConfig: Record<string, Record<string, ModuleConfig>> = {
    'wallet': {
        'batch-generate': {
            title: '批量生成钱包',
            subtitle: '快速批量生成 Solana 钱包，支持多种生成模式'
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
    }
};

// UI 核心管理类
export class UIManager {
    private appState: AppState;
    private sidebarNav: HTMLElement | null = null; // Initialize as null
    private mainContent: HTMLElement | null = null; // Initialize as null

    constructor() {
        this.appState = AppState.getInstance();
        // DOM selections are moved to initDOMReferences
        // console.log('UIManager constructor: sidebarNav found?', !!this.sidebarNav); // Remove or keep for later
        // console.log('UIManager constructor: mainContent found?', !!this.mainContent); // Remove or keep for later
    }

    public initDOMReferences(): void {
        this.sidebarNav = document.querySelector('.sidebar-nav');
        this.mainContent = document.querySelector('.main-content');
        console.log('UIManager initDOMReferences: sidebarNav found?', !!this.sidebarNav);
        console.log('UIManager initDOMReferences: mainContent found?', !!this.mainContent);
    }

    // 生成导航菜单
    public generateNavigationMenu(): void {
        console.log('generateNavigationMenu called');
        if (!this.sidebarNav) {
            console.error("Sidebar navigation element (.sidebar-nav) not found!");
            return;
        }

        let menuHtml = '';
        for (const moduleId in moduleConfig) {
            const module = moduleConfig[moduleId];
            const firstSubmoduleId = Object.keys(module)[0]; // Get the first submodule ID

            menuHtml += `
                <div class="nav-module">
                    <div class="nav-module-header" onclick="uiManager.toggleModule('${moduleId}')">
                        <span class="nav-module-arrow" id="${moduleId}-arrow">▶</span>
                        <span>${this.getModuleTitle(moduleId)}</span>
                    </div>
                    <div class="nav-submenu" id="${moduleId}-submenu">
            `;

            for (const submoduleId in module) {
                const submodule = module[submoduleId];
                menuHtml += `
                        <div class="nav-submodule" onclick="uiManager.showSubmodule('${moduleId}', '${submoduleId}')">
                            ${submodule.title}
                        </div>
                `;
            }
            menuHtml += `</div></div>`;
        }
        console.log('Generated menu HTML:', menuHtml);
        this.sidebarNav.innerHTML = menuHtml;
        console.log('Sidebar navigation HTML set.');
    }

    // 生成工作区
    public generateWorkspaces(): void {
        console.log('generateWorkspaces called');
        if (!this.mainContent) {
            console.error("Main content element (.main-content) not found!");
            return;
        }

        // 确保 content-header 存在且结构正确
        let contentHeader = this.mainContent.querySelector('.content-header');
        if (!contentHeader) {
            console.log('Creating content-header...');
            contentHeader = document.createElement('div');
            contentHeader.className = 'content-header';
            contentHeader.innerHTML = `
                <h1 id="content-title">欢迎</h1>
                <p id="content-subtitle">请从左侧菜单选择一个功能开始。</p>
            `;
            this.mainContent.insertBefore(contentHeader, this.mainContent.firstChild);
        }
        
        // 检查现有工作区
        const existingWorkspaces = this.mainContent.querySelectorAll('.workspace');
        console.log(`Found ${existingWorkspaces.length} existing workspaces`);
        
        // 如果没有预定义的工作区，则动态生成占位符工作区
        if (existingWorkspaces.length === 0) {
            console.log('No existing workspaces found, generating placeholders...');
            this.generatePlaceholderWorkspaces();
        } else {
            console.log('Using existing workspaces from HTML');
        }
        
        console.log('Workspaces initialization completed.');
    }

    // 生成占位符工作区（仅在没有预定义工作区时使用）
    private generatePlaceholderWorkspaces(): void {
        if (!this.mainContent) return;

        const contentBody = this.mainContent.querySelector('.content-body') || this.mainContent;
        
        for (const moduleId in moduleConfig) {
            for (const submoduleId in moduleConfig[moduleId]) {
                const workspaceId = `${moduleId}-${submoduleId}-workspace`;
                
                // 检查是否已存在
                if (document.getElementById(workspaceId)) continue;
                
                const workspace = document.createElement('div');
                workspace.id = workspaceId;
                workspace.className = 'workspace hidden';
                workspace.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #718096;">
                        <h3>${moduleConfig[moduleId][submoduleId].title}</h3>
                        <p>此模块正在开发中...</p>
                    </div>
                `;
                contentBody.appendChild(workspace);
            }
        }
    }

    private getModuleTitle(moduleId: string): string {
        if (moduleId === 'wallet') return '钱包管理';
        if (moduleId === 'token') return '代币工具';
        return moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
    }

    // 切换模块折叠状态
    public toggleModule(moduleId: string): void {
        const submenu = document.getElementById(`${moduleId}-submenu`);
        const arrow = document.getElementById(`${moduleId}-arrow`);
        const moduleHeader = document.querySelector(`#${moduleId}-arrow`)?.closest('.nav-module-header');
        
        if (!submenu || !arrow || !moduleHeader) {
            console.error('ToggleModule: Missing elements for', moduleId);
            return;
        }
        
        if (submenu.classList.contains('expanded')) {
            submenu.classList.remove('expanded');
            arrow.classList.remove('expanded');
            moduleHeader.classList.remove('active'); 
        } else {
            this.closeAllModules();
            submenu.classList.add('expanded');
            arrow.classList.add('expanded');
            moduleHeader.classList.add('active');
            
            if (this.appState.currentModule !== moduleId) {
                const firstSubmodule = submenu.querySelector('.nav-submodule');
                if (firstSubmodule) {
                    const onclickAttr = firstSubmodule.getAttribute('onclick');
                    if (onclickAttr) {
                        const matches = onclickAttr.match(/'([^']*)'.*'([^']*)'/);
                        if (matches && matches[2]) {
                            this.showSubmodule(moduleId, matches[2]);
                        }
                    }
                }
            }
        }
    }

    // 显示子模块
    public showSubmodule(moduleId: string, submoduleId: string): void {
        this.appState.currentModule = moduleId;
        this.appState.currentSubmodule = submoduleId;
        
        this.updateNavigationState(moduleId, submoduleId);
        this.updateContentTitle(moduleId, submoduleId);
        this.switchWorkspace(moduleId, submoduleId);
        
        const moduleHeader = document.querySelector(`#${moduleId}-arrow`)?.closest('.nav-module-header');
        if(moduleHeader && !moduleHeader.classList.contains('active')){
            this.ensureModuleExpanded(moduleId);
        } else if (!moduleHeader) {
            this.ensureModuleExpanded(moduleId);
        }
    }

    // 复制到剪贴板
    public async copyToClipboard(elementId: string): Promise<void> {
        try {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const text = element.textContent || '';
            await navigator.clipboard.writeText(text);
            
            this.showCopyFeedback(element);
            
        } catch (error) {
            console.error('复制失败:', error);
            alert('复制失败，请手动选择文本复制');
        }
    }

    private closeAllModules(): void {
        document.querySelectorAll('.nav-submenu').forEach(menu => {
            menu.classList.remove('expanded');
        });
        document.querySelectorAll('.nav-module-arrow').forEach(arr => {
            arr.classList.remove('expanded');
        });
        document.querySelectorAll('.nav-module-header').forEach(header => {
            header.classList.remove('active');
        });
    }
    
    private updateNavigationState(moduleId: string, submoduleId: string): void {
        document.querySelectorAll('.nav-submodule').forEach(item => {
            item.classList.remove('active');
        });
        
        const targetSubmodule = document.querySelector(`.nav-submodule[onclick*="uiManager.showSubmodule('${moduleId}', '${submoduleId}')"]`);
        if (targetSubmodule) {
            targetSubmodule.classList.add('active');
        }

        document.querySelectorAll('.nav-module-header').forEach(header => {
            header.classList.remove('active');
        });
        const moduleHeader = document.querySelector(`#${moduleId}-arrow`)?.closest('.nav-module-header');
        if (moduleHeader) {
            moduleHeader.classList.add('active');
        }
    }
    
    private updateContentTitle(moduleId: string, submoduleId: string): void {
        const config = moduleConfig[moduleId]?.[submoduleId];
        if (config) {
            const titleElement = document.getElementById('content-title');
            const subtitleElement = document.getElementById('content-subtitle');
            if (titleElement) titleElement.textContent = config.title;
            if (subtitleElement) subtitleElement.textContent = config.subtitle;
        }
    }
    
    private switchWorkspace(moduleId: string, submoduleId: string): void {
        document.querySelectorAll('[id$="-workspace"]').forEach(workspace => {
            workspace.classList.add('hidden');
        });
        
        const workspaceId = `${moduleId}-${submoduleId}-workspace`;
        const workspace = document.getElementById(workspaceId);
        if (workspace) {
            workspace.classList.remove('hidden');
        }
    }
    
    private ensureModuleExpanded(moduleId: string): void {
        const submenu = document.getElementById(`${moduleId}-submenu`);
        const arrow = document.getElementById(`${moduleId}-arrow`);
        const moduleHeader = arrow?.closest('.nav-module-header');
        
        if (submenu && arrow && moduleHeader && !submenu.classList.contains('expanded')) {
            submenu.classList.add('expanded');
            arrow.classList.add('expanded');
            moduleHeader.classList.add('active');
        }
    }
    
    private showCopyFeedback(element: Element): void {
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
    }

    // 通用文件下载工具方法
    public downloadAsJson(data: any, filename: string): void {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 生成带时间戳的文件名
    public generateTimestampedFilename(prefix: string, extension: string = 'json'): string {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        return `${prefix}-${timestamp}.${extension}`;
    }

    // 通用错误处理
    public handleError(error: any, context: string = '操作'): void {
        console.error(`${context}失败:`, error);
        const message = error?.message || '未知错误';
        alert(`${context}失败: ${message}`);
    }

    // 通用成功提示
    public showSuccess(message: string): void {
        console.log(`✅ ${message}`);
        // 可以在这里添加更美观的成功提示，比如 toast 通知
    }

    // 通用信息提示
    public showInfo(message: string): void {
        console.log(`ℹ️ ${message}`);
        alert(message);
    }
}

// 导出单例实例
export const uiManager = new UIManager();
export const appState = AppState.getInstance();
