// 销量快报 - 主应用逻辑

// ==================== 数据层 ====================

// 模拟数据生成器
const DataGenerator = {
    // 生成随机销量数据
    randomSales(min = 100, max = 10000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 生成组织数据
    generateOrgData(orgType, count = 10) {
        const orgs = {
            division: ['昆明', '西安', '成都', '重庆', '贵阳', '南宁', '拉萨', '兰州', '西宁', '银川'],
            center: ['昆明中心', '西安中心', '成都中心', '重庆中心', '贵阳中心', '南宁中心', '拉萨中心', '兰州中心', '西宁中心', '银川中心']
        };
        
        const names = orgs[orgType] || orgs.division;
        return names.slice(0, count).map((name, index) => {
            const current = this.randomSales(500, 8000);
            const period = this.randomSales(400, 7500);
            const change = current - period;
            const growth = period !== 0 ? ((change / period) * 100).toFixed(1) : '0.0';
            
            return {
                rank: index + 1,
                name: name,
                current: current,
                period: period,
                change: change,
                growth: parseFloat(growth),
                contribution: Math.random() * 20 - 5 // -5% to 15%
            };
        });
    },

    // 生成品牌数据
    generateBrandData(count = 10) {
        const orgs = ['昆明', '西安', '成都', '重庆', '贵阳', '南宁', '拉萨', '兰州', '西宁', '银川'];
        return orgs.slice(0, count).map((name, index) => {
            const totalCurrent = this.randomSales(500, 8000);
            const totalPeriod = this.randomSales(400, 7500);
            const chinaCurrent = Math.floor(totalCurrent * 0.7);
            const chinaPeriod = Math.floor(totalPeriod * 0.7);
            const intlCurrent = totalCurrent - chinaCurrent;
            const intlPeriod = totalPeriod - chinaPeriod;
            
            return {
                rank: index + 1,
                name: name,
                total: { current: totalCurrent, period: totalPeriod },
                china: { current: chinaCurrent, period: chinaPeriod },
                international: { current: intlCurrent, period: intlPeriod }
            };
        });
    },

    // 生成品种数据
    generateVarietyData() {
        const varieties = ['黑狮', '悠世', '秦始皇', '苏尔', '红狮轻卡', '马尔斯绿', '匠心营造', '雪花脸谱'];
        return varieties.map((name, index) => {
            const current = this.randomSales(100, 3000);
            const period = this.randomSales(80, 2800);
            const change = current - period;
            const growth = period !== 0 ? ((change / period) * 100).toFixed(1) : '0.0';
            
            return {
                rank: index + 1,
                name: name,
                current: current,
                period: period,
                change: change,
                growth: parseFloat(growth),
                contribution: Math.random() * 15 - 3
            };
        });
    }
};

// ==================== 状态管理 ====================

const AppState = {
    currentDimension: 'grade',
    currentTime: 'day',
    currentOrg: 'division',
    currentPage: 1,
    totalPages: 4,
    isFabOpen: false,

    setDimension(dimension) {
        this.currentDimension = dimension;
        this.triggerUpdate();
    },

    setTime(time) {
        this.currentTime = time;
        this.triggerUpdate();
    },

    setOrg(org) {
        this.currentOrg = org;
        this.triggerUpdate();
    },

    triggerUpdate() {
        document.dispatchEvent(new CustomEvent('appStateChange', {
            detail: { ...this }
        }));
    }
};

// ==================== UI渲染器 ====================

const Renderer = {
    // 渲染表格数据
    renderTable() {
        const tbody = document.getElementById('tableBody');
        const dimension = AppState.currentDimension;
        
        let html = '';
        
        switch(dimension) {
            case 'grade':
            case 'main':
                html = this.renderStandardTable();
                break;
            case 'brand':
                html = this.renderBrandTable();
                break;
            case 'other':
                html = this.renderVarietyTable();
                break;
        }
        
        tbody.innerHTML = html;
    },

    // 标准表格（分档次/分主力品种）
    renderStandardTable() {
        const data = DataGenerator.generateOrgData(AppState.currentOrg);
        
        return data.map(item => {
            const isNegative = item.growth < 0;
            const growthClass = isNegative ? 'negative' : 'positive';
            const rowClass = isNegative ? 'row-negative' : '';
            const growthSymbol = item.growth > 0 ? '↑' : '↓';
            
            return `
                <tr class="${rowClass}" data-org="${item.name}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">
                        <div class="org-name">
                            ${item.name}
                            <span class="org-expand">›</span>
                        </div>
                    </td>
                    <td>${item.current.toLocaleString()}</td>
                    <td>${item.period.toLocaleString()}</td>
                    <td class="${growthClass}">${item.change > 0 ? '+' : ''}${item.change.toLocaleString()}</td>
                    <td class="${growthClass}">${item.growth}%${growthSymbol}</td>
                    <td>
                        <div class="contribution-bar">
                            <div class="contribution-fill ${item.contribution >= 0 ? 'positive' : 'negative'}" 
                                 style="width: ${Math.min(Math.abs(item.contribution) * 5, 100)}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 品牌表格
    renderBrandTable() {
        const data = DataGenerator.generateBrandData();
        
        return data.map(item => {
            const totalChange = item.total.current - item.total.period;
            const chinaChange = item.china.current - item.china.period;
            const intlChange = item.international.current - item.international.period;
            
            return `
                <tr data-org="${item.name}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">
                        <div class="org-name">
                            ${item.name}
                            <span class="org-expand">›</span>
                        </div>
                    </td>
                    <td>${item.total.current.toLocaleString()}</td>
                    <td class="${totalChange >= 0 ? 'positive' : 'negative'}">${totalChange > 0 ? '+' : ''}${totalChange.toLocaleString()}</td>
                    <td>${item.china.current.toLocaleString()}</td>
                    <td class="${chinaChange >= 0 ? 'positive' : 'negative'}">${chinaChange > 0 ? '+' : ''}${chinaChange.toLocaleString()}</td>
                    <td>${item.international.current.toLocaleString()}</td>
                    <td class="${intlChange >= 0 ? 'positive' : 'negative'}">${intlChange > 0 ? '+' : ''}${intlChange.toLocaleString()}</td>
                </tr>
            `;
        }).join('');
    },

    // 品种表格（其他）
    renderVarietyTable() {
        const data = DataGenerator.generateVarietyData();
        
        return data.map(item => {
            const isNegative = item.growth < 0;
            const growthClass = isNegative ? 'negative' : 'positive';
            const rowClass = isNegative ? 'row-negative' : '';
            const growthSymbol = item.growth > 0 ? '↑' : '↓';
            
            return `
                <tr class="${rowClass}" data-org="${item.name}">
                    <td class="col-rank">${item.rank}</td>
                    <td class="col-org">${item.name}</td>
                    <td>${item.current.toLocaleString()}</td>
                    <td>${item.period.toLocaleString()}</td>
                    <td class="${growthClass}">${item.change > 0 ? '+' : ''}${item.change.toLocaleString()}</td>
                    <td class="${growthClass}">${item.growth}%${growthSymbol}</td>
                    <td>
                        <div class="contribution-bar">
                            <div class="contribution-fill ${item.contribution >= 0 ? 'positive' : 'negative'}" 
                                 style="width: ${Math.min(Math.abs(item.contribution) * 5, 100)}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 更新Banner标题
    updateBanner() {
        const titles = {
            grade: '全国普及及以上生意表现',
            brand: '全国分品牌生意表现',
            main: '全国喜力生意表现',
            other: '全国其他品种生意表现'
        };
        
        const titleEl = document.getElementById('bannerTitle');
        if (titleEl) {
            titleEl.textContent = titles[AppState.currentDimension] || titles.grade;
        }
    },

    // 更新汇总卡片
    updateSummary() {
        const summaries = {
            grade: { label: '🏷 普高及以上销量表现', value: '1,663,393 KL', change: '+90,134', growth: '6%↑' },
            brand: { label: '🏷 分品牌销量表现', value: '2,156,789 KL', change: '+125,678', growth: '8.2%↑' },
            main: { label: '🏷 喜力销量表现', value: '856,234 KL', change: '+45,678', growth: '5.6%↑' },
            other: { label: '🏷 其他品种销量表现', value: '423,567 KL', change: '-12,345', growth: '2.8%↓' }
        };
        
        const summary = summaries[AppState.currentDimension] || summaries.grade;
        
        const labelEl = document.querySelector('.summary-label');
        const valueEl = document.querySelector('.summary-value');
        const changeEl = document.getElementById('summaryChange');
        const growthEl = document.getElementById('summaryGrowth');
        
        if (labelEl) labelEl.textContent = summary.label;
        if (valueEl) valueEl.textContent = summary.value;
        if (changeEl) {
            changeEl.textContent = summary.change;
            changeEl.className = 'metric-value ' + (summary.change.startsWith('+') ? 'positive' : 'negative');
        }
        if (growthEl) {
            growthEl.textContent = summary.growth;
            growthEl.className = 'metric-value ' + (summary.growth.includes('↑') ? 'positive' : 'negative');
        }
    },

    // 更新表格表头
    updateTableHeader() {
        const thead = document.querySelector('.data-table thead tr');
        if (!thead) return;
        
        const dimension = AppState.currentDimension;
        
        if (dimension === 'brand') {
            thead.innerHTML = `
                <th class="col-rank">排名</th>
                <th class="col-org">组织</th>
                <th>整体当期</th>
                <th>整体增减</th>
                <th>中国品牌</th>
                <th>中国增减</th>
                <th>国际品牌</th>
                <th>国际增减</th>
            `;
        } else {
            thead.innerHTML = `
                <th class="col-rank">排名</th>
                <th class="col-org">组织</th>
                <th class="col-current">当期</th>
                <th class="col-period">同期</th>
                <th class="col-change">同比增减</th>
                <th class="col-growth">同比增幅</th>
                <th class="col-contribution">增量贡献</th>
            `;
        }
    }
};

// ==================== 事件处理 ====================

const EventHandler = {
    init() {
        this.initDimensionTabs();
        this.initTimeTabs();
        this.initOrgTabs();
        this.initFabButton();
        this.initTableInteraction();
        this.initPullRefresh();
        
        // 监听状态变化
        document.addEventListener('appStateChange', () => {
            Renderer.updateBanner();
            Renderer.updateSummary();
            Renderer.updateTableHeader();
            Renderer.renderTable();
        });
        
        // 初始渲染
        Renderer.renderTable();
    },

    // 维度标签切换
    initDimensionTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.setDimension(tab.dataset.dimension);
            });
        });
    },

    // 时间标签切换
    initTimeTabs() {
        const tabs = document.querySelectorAll('.time-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.setTime(tab.dataset.time);
            });
        });
    },

    // 组织标签切换
    initOrgTabs() {
        const tabs = document.querySelectorAll('.org-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                AppState.setOrg(tab.dataset.org);
            });
        });
    },

    // 快捷按钮
    initFabButton() {
        const fab = document.getElementById('fabButton');
        const menu = document.getElementById('fabMenu');
        
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            AppState.isFabOpen = !AppState.isFabOpen;
            menu.classList.toggle('show', AppState.isFabOpen);
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', () => {
            if (AppState.isFabOpen) {
                AppState.isFabOpen = false;
                menu.classList.remove('show');
            }
        });
        
        // 菜单项点击
        menu.querySelectorAll('.fab-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleFabAction(action);
                AppState.isFabOpen = false;
                menu.classList.remove('show');
            });
        });
    },

    // 处理快捷按钮动作
    handleFabAction(action) {
        switch(action) {
            case 'help':
                alert('数据说明：\n\n• 当期：当前周期的销量数据\n• 同期：上年同期的销量数据\n• 同比增减：当期 - 同期\n• 同比增幅：(当期-同期)/同期×100%\n• 增量贡献：该组织同比增减/全国总同比增减×100%');
                break;
            case 'feedback':
                alert('意见反馈功能待补充');
                break;
            case 'back':
                alert('返回工作台');
                break;
        }
    },

    // 表格交互
    initTableInteraction() {
        const tableBody = document.getElementById('tableBody');
        
        tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                const orgName = row.dataset.org;
                this.handleRowClick(orgName);
            }
        });
    },

    // 处理行点击
    handleRowClick(orgName) {
        alert(`点击了组织：${orgName}\n\n这里可以展开子级数据或进入详情页`);
    },

    // 下拉刷新
    initPullRefresh() {
        let startY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isPulling = window.scrollY === 0;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            if (diff > 60 && window.scrollY === 0) {
                const pullRefresh = document.getElementById('pullRefresh');
                pullRefresh.classList.add('show');
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (!isPulling) return;
            
            const pullRefresh = document.getElementById('pullRefresh');
            if (pullRefresh.classList.contains('show')) {
                setTimeout(() => {
                    pullRefresh.classList.remove('show');
                    // 模拟刷新数据
                    Renderer.renderTable();
                }, 1000);
            }
            isPulling = false;
        });
    }
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    EventHandler.init();
    
    // 设置当前日期
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    const dateEl = document.getElementById('bannerDate');
    if (dateEl) {
        dateEl.textContent = dateStr;
    }
});
