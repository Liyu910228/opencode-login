// 销量快报 - 主应用逻辑

// 模拟数据生成器
const MockData = {
    // 生成随机销量数据
    generateSalesData(count = 10) {
        const orgs = [
            '昆明', '西安', '成都', '重庆', '贵阳',
            '南宁', '兰州', '银川', '西宁', '乌鲁木齐',
            '拉萨', '呼和浩特', '太原', '石家庄', '济南'
        ];
        
        return orgs.slice(0, count).map((org, index) => {
            const current = Math.floor(Math.random() * 5000) + 500;
            const period = Math.floor(Math.random() * 5000) + 400;
            const change = current - period;
            const growth = period !== 0 ? ((change / period) * 100).toFixed(1) : '0.0';
            
            return {
                rank: index + 1,
                org: org,
                current: current,
                period: period,
                change: change,
                growth: parseFloat(growth),
                contrib: Math.random() * 20 - 5 // -5% to 15%
            };
        });
    },
    
    // 生成品牌数据（分品牌维度）
    generateBrandData(count = 10) {
        const orgs = ['昆明', '西安', '成都', '重庆', '贵阳', '南宁', '兰州', '银川', '西宁', '乌鲁木齐'];
        
        return orgs.slice(0, count).map((org, index) => {
            const totalCurrent = Math.floor(Math.random() * 5000) + 500;
            const totalPeriod = Math.floor(Math.random() * 5000) + 400;
            const chinaCurrent = Math.floor(totalCurrent * 0.7);
            const chinaPeriod = Math.floor(totalPeriod * 0.7);
            const intlCurrent = totalCurrent - chinaCurrent;
            const intlPeriod = totalPeriod - chinaPeriod;
            
            return {
                rank: index + 1,
                org: org,
                totalCurrent: totalCurrent,
                totalChange: totalCurrent - totalPeriod,
                chinaCurrent: chinaCurrent,
                chinaChange: chinaCurrent - chinaPeriod,
                intlCurrent: intlCurrent,
                intlChange: intlPeriod - intlPeriod
            };
        });
    },
    
    // 生成其他品种数据
    generateOtherData() {
        const products = ['黑狮', '悠世', '秦始皇', '苏尔', '红狮轻卡', '马尔斯绿', '匠心营造', '雪花脸谱'];
        
        return products.map((product, index) => {
            const current = Math.floor(Math.random() * 3000) + 200;
            const period = Math.floor(Math.random() * 3000) + 150;
            const change = current - period;
            const growth = period !== 0 ? ((change / period) * 100).toFixed(1) : '0.0';
            
            return {
                rank: index + 1,
                product: product,
                current: current,
                period: period,
                change: change,
                growth: parseFloat(growth),
                contrib: Math.random() * 15 - 3
            };
        });
    }
};

// 应用状态
const AppState = {
    currentDimension: 'grade',
    currentSubTab: 'all',
    currentTime: 'month',
    currentOrg: 'division',
    isFabOpen: false,
    
    // 维度配置
    dimensionConfig: {
        grade: {
            title: '全国分档次生意表现',
            summaryLabel: '🏷 分档次销量表现',
            hasSubTabs: true
        },
        brand: {
            title: '全国分品牌生意表现',
            summaryLabel: '🏷 分品牌销量表现',
            hasSubTabs: false
        },
        product: {
            title: '全国喜力生意表现',
            summaryLabel: '🏷 喜力销量表现',
            hasSubTabs: false
        },
        other: {
            title: '全国其他品种生意表现',
            summaryLabel: '🏷 其他品种销量表现',
            hasSubTabs: false
        }
    },
    
    // 二级页签配置
    subTabConfig: {
        all: { title: '全国分档次生意表现', label: '分档次销量表现' },
        premium: { title: '全国普高及以上生意表现', label: '普高及以上销量表现' },
        high: { title: '全国次高生意表现', label: '次高销量表现' },
        medium: { title: '全国中档生意表现', label: '中档销量表现' },
        mainstream: { title: '全国大主流生意表现', label: '大主流销量表现' }
    }
};

// DOM 元素
const DOM = {
    bannerTitle: document.getElementById('bannerTitle'),
    bannerDate: document.getElementById('bannerDate'),
    summaryLabel: document.getElementById('summaryLabel'),
    summaryValue: document.getElementById('summaryValue'),
    summaryChange: document.getElementById('summaryChange'),
    summaryGrowth: document.getElementById('summaryGrowth'),
    tableBody: document.getElementById('tableBody'),
    subTabs: document.getElementById('subTabs'),
    fabButton: document.getElementById('fabButton'),
    fabOptions: document.getElementById('fabOptions'),
    pullRefresh: document.getElementById('pullRefresh')
};

// 工具函数
const Utils = {
    // 格式化数字
    formatNumber(num) {
        return num.toLocaleString('zh-CN');
    },
    
    // 格式化变化值（带符号）
    formatChange(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${this.formatNumber(value)}`;
    },
    
    // 格式化百分比
    formatPercent(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value}%`;
    },
    
    // 获取当前日期
    getCurrentDate() {
        const now = new Date();
        return `${now.getFullYear()}年${now.getMonth() + 1}月`;
    }
};

// 表格渲染
const TableRenderer = {
    // 渲染标准表格（分档次/分主力品种/其他）
    renderStandardTable(data) {
        const totalCurrent = data.reduce((sum, item) => sum + item.current, 0);
        
        return data.map(item => {
            const isNegative = item.growth < 0;
            const rowClass = isNegative ? 'negative-row' : '';
            const changeClass = item.change >= 0 ? 'positive' : 'negative';
            const growthClass = item.growth >= 0 ? 'positive' : 'negative';
            const contribPercent = Math.min(Math.abs(item.contrib) * 5, 100);
            const contribClass = item.contrib >= 0 ? 'positive' : 'negative';
            
            return `
                <tr class="${rowClass}" data-org="${item.org}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">
                        <div class="org-name">
                            <span>${item.org}</span>
                            <span class="expand-icon">›</span>
                        </div>
                    </td>
                    <td>${Utils.formatNumber(item.current)}</td>
                    <td>${Utils.formatNumber(item.period)}</td>
                    <td class="${changeClass}">${Utils.formatChange(item.change)}</td>
                    <td class="${growthClass}">${Utils.formatPercent(item.growth)}</td>
                    <td>
                        <div class="contrib-bar">
                            <div class="contrib-bar-fill ${contribClass}" style="width: ${contribPercent}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // 渲染品牌表格（分品牌维度）
    renderBrandTable(data) {
        return data.map(item => {
            return `
                <tr data-org="${item.org}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">
                        <div class="org-name">
                            <span>${item.org}</span>
                            <span class="expand-icon">›</span>
                        </div>
                    </td>
                    <td>${Utils.formatNumber(item.totalCurrent)}<br><small>${item.totalChange >= 0 ? '+' : ''}${Utils.formatNumber(item.totalChange)}</small></td>
                    <td>${Utils.formatNumber(item.chinaCurrent)}<br><small>${item.chinaChange >= 0 ? '+' : ''}${Utils.formatNumber(item.chinaChange)}</small></td>
                    <td>${Utils.formatNumber(item.intlCurrent)}<br><small>${item.intlChange >= 0 ? '+' : ''}${Utils.formatNumber(item.intlChange)}</small></td>
                </tr>
            `;
        }).join('');
    },
    
    // 渲染其他品种表格
    renderOtherTable(data) {
        return data.map(item => {
            const isNegative = item.growth < 0;
            const rowClass = isNegative ? 'negative-row' : '';
            const changeClass = item.change >= 0 ? 'positive' : 'negative';
            const growthClass = item.growth >= 0 ? 'positive' : 'negative';
            const contribPercent = Math.min(Math.abs(item.contrib) * 5, 100);
            const contribClass = item.contrib >= 0 ? 'positive' : 'negative';
            
            return `
                <tr class="${rowClass}" data-product="${item.product}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">${item.product}</td>
                    <td>${Utils.formatNumber(item.current)}</td>
                    <td>${Utils.formatNumber(item.period)}</td>
                    <td class="${changeClass}">${Utils.formatChange(item.change)}</td>
                    <td class="${growthClass}">${Utils.formatPercent(item.growth)}</td>
                    <td>
                        <div class="contrib-bar">
                            <div class="contrib-bar-fill ${contribClass}" style="width: ${contribPercent}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
};

// 事件处理
const EventHandler = {
    // 初始化
    init() {
        this.bindDimensionTabs();
        this.bindSubTabs();
        this.bindTimeTabs();
        this.bindOrgTabs();
        this.bindFabMenu();
        this.bindTableInteractions();
        this.bindPullRefresh();
        this.updateUI();
    },
    
    // 绑定维度标签
    bindDimensionTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                AppState.currentDimension = e.target.dataset.dimension;
                this.updateUI();
            });
        });
    },
    
    // 绑定二级页签
    bindSubTabs() {
        document.querySelectorAll('.sub-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                AppState.currentSubTab = e.target.dataset.sub;
                this.updateUI();
            });
        });
    },
    
    // 绑定时间标签
    bindTimeTabs() {
        document.querySelectorAll('.time-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                AppState.currentTime = e.target.dataset.time;
                this.updateUI();
            });
        });
    },
    
    // 绑定组织标签
    bindOrgTabs() {
        document.querySelectorAll('.org-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.org-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                AppState.currentOrg = e.target.dataset.org;
                this.updateUI();
            });
        });
    },
    
    // 绑定快捷菜单
    bindFabMenu() {
        DOM.fabButton.addEventListener('click', () => {
            AppState.isFabOpen = !AppState.isFabOpen;
            DOM.fabOptions.classList.toggle('visible', AppState.isFabOpen);
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fab-menu')) {
                AppState.isFabOpen = false;
                DOM.fabOptions.classList.remove('visible');
            }
        });
        
        // 菜单项点击
        document.querySelectorAll('.fab-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                switch(action) {
                    case 'explain':
                        alert('数据说明：\n\n当期：当前周期的销量数据\n同期：上年同期的销量数据\n同比增减：当期 - 同期\n同比增幅：(当期 - 同期) / 同期 × 100%\n增量贡献：该组织同比增减 / 全国总同比增减 × 100%');
                        break;
                    case 'feedback':
                        alert('意见反馈功能待补充');
                        break;
                    case 'back':
                        alert('返回工作台');
                        break;
                }
                AppState.isFabOpen = false;
                DOM.fabOptions.classList.remove('visible');
            });
        });
    },
    
    // 绑定表格交互
    bindTableInteractions() {
        DOM.tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                const org = row.dataset.org;
                const product = row.dataset.product;
                const expandIcon = row.querySelector('.expand-icon');
                
                if (expandIcon) {
                    expandIcon.classList.toggle('expanded');
                }
                
                // 模拟下钻
                if (org) {
                    console.log(`下钻到: ${org}`);
                    // 这里可以添加实际的下钻逻辑
                }
            }
        });
    },
    
    // 绑定下拉刷新
    bindPullRefresh() {
        let startY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            if (diff > 50 && window.scrollY === 0) {
                DOM.pullRefresh.classList.add('visible');
            }
        });
        
        document.addEventListener('touchend', () => {
            if (DOM.pullRefresh.classList.contains('visible')) {
                setTimeout(() => {
                    DOM.pullRefresh.classList.remove('visible');
                    this.updateUI();
                }, 1000);
            }
            isPulling = false;
        });
    },
    
    // 更新UI
    updateUI() {
        const config = AppState.dimensionConfig[AppState.currentDimension];
        
        // 更新Banner
        if (AppState.currentDimension === 'grade' && AppState.currentSubTab) {
            const subConfig = AppState.subTabConfig[AppState.currentSubTab];
            DOM.bannerTitle.textContent = subConfig.title;
            DOM.summaryLabel.textContent = subConfig.label;
        } else {
            DOM.bannerTitle.textContent = config.title;
            DOM.summaryLabel.textContent = config.summaryLabel;
        }
        
        DOM.bannerDate.textContent = Utils.getCurrentDate();
        
        // 显示/隐藏二级页签
        DOM.subTabs.classList.toggle('visible', config.hasSubTabs);
        
        // 更新汇总数据
        this.updateSummaryData();
        
        // 更新表格
        this.updateTable();
    },
    
    // 更新汇总数据
    updateSummaryData() {
        const baseValue = Math.floor(Math.random() * 2000000) + 1000000;
        const change = Math.floor(Math.random() * 200000) - 50000;
        const growth = ((change / baseValue) * 100).toFixed(1);
        
        DOM.summaryValue.textContent = `${Utils.formatNumber(baseValue)} KL`;
        DOM.summaryChange.textContent = Utils.formatChange(change);
        DOM.summaryChange.className = `change-value ${change >= 0 ? 'positive' : 'negative'}`;
        DOM.summaryGrowth.textContent = Utils.formatPercent(parseFloat(growth));
        DOM.summaryGrowth.className = `change-value ${parseFloat(growth) >= 0 ? 'positive' : 'negative'}`;
    },
    
    // 更新表格
    updateTable() {
        let html = '';
        
        switch (AppState.currentDimension) {
            case 'grade':
            case 'product':
                html = TableRenderer.renderStandardTable(MockData.generateSalesData());
                break;
            case 'brand':
                html = TableRenderer.renderBrandTable(MockData.generateBrandData());
                break;
            case 'other':
                html = TableRenderer.renderOtherTable(MockData.generateOtherData());
                break;
        }
        
        DOM.tableBody.innerHTML = html;
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    EventHandler.init();
});
