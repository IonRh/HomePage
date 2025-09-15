// API配置
const API_BASE_URL = 'https://blog.www-dabaobei7517.workers.dev';

// GitHub用户名将从API获取
let GITHUB_USERNAME = 'IonRh'; // 默认值，将被API数据覆盖

// 功能开关（由API控制）
let FEATURE_ICE = false;   // 夏日空调
let FEATURE_THEMA = false; // 背景切换


//GitHub贡献图
async function fetchGitHubContributions(username) {
    try {
        console.log('正在获取GitHub贡献数据...');
        
        // 首先尝试从GitHub API获取真实数据
        const contributionData = await fetchRealGitHubData(username);
        
        // 更新贡献图
        updateContributionChart(contributionData, 'api');
        
        // 统计数据已移除，无需更新
        
    } catch (error) {
        console.error('获取GitHub贡献数据失败:', error);
        // 使用备用方案：GitHub贡献图API
        try {
            const {data: fallbackData, source} = await fetchGitHubContributionsFromAPI(username);
            updateContributionChart(fallbackData, source);
        } catch (fallbackError) {
            console.error('备用API也失败:', fallbackError);
            // 最后使用模拟数据
            const mockData = generateMockContributions();
            updateContributionChart(mockData, 'generated');
        }
    }
}

// 获取真实GitHub贡献数据
async function fetchRealGitHubData(username) {
    // 使用GitHub GraphQL API获取贡献数据
    const query = `
        query($username: String!) {
            user(login: $username) {
                contributionsCollection {
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                contributionCount
                                date
                            }
                        }
                    }
                }
            }
        }
    `;
    
    // 注意：这需要GitHub Personal Access Token
    // 由于安全原因，我们使用公开的第三方API作为替代方案
    throw new Error('需要使用第三方API');
}

// 使用第三方API获取GitHub贡献数据
async function fetchGitHubContributionsFromAPI(username) {
    console.log(`正在获取 ${username} 的GitHub贡献数据...`);
    
    // 尝试多个API源
    const apiSources = [
        {
            name: 'GitHub Contributions API',
            url: `https://github-contributions-api.jogruber.de/v4/${username}`,
            parser: (data) => {
                const contributions = [];
                if (data.contributions) {
                    data.contributions.forEach(contribution => {
                        contributions.push({
                            date: contribution.date,
                            count: contribution.count,
                            level: getContributionLevel(contribution.count)
                        });
                    });
                }
                return contributions;
            }
        },
        {
            name: 'Alternative API',
            url: `https://github-calendar-api.vercel.app/api/${username}`,
            parser: (data) => {
                const contributions = [];
                if (data && data.contributions) {
                    Object.entries(data.contributions).forEach(([date, count]) => {
                        contributions.push({
                            date: date,
                            count: count,
                            level: getContributionLevel(count)
                        });
                    });
                }
                return contributions;
            }
        }
    ];
    
    // 尝试每个API源
    for (const source of apiSources) {
        try {
            console.log(`尝试 ${source.name}...`);
            const response = await fetch(source.url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`${source.name} 返回数据:`, data);
            
            const contributions = source.parser(data);
            if (contributions.length > 0) {
                console.log(`成功从 ${source.name} 获取到 ${contributions.length} 天的数据`);
                return {data: contributions, source: 'api'};
            }
        } catch (error) {
            console.warn(`${source.name} 失败:`, error);
        }
    }
    
    // 所有API都失败，使用备用方案
    console.log('所有API源都失败，使用备用方案');
    const profileData = await fetchGitHubContributionsFromProfile(username);
    return {data: profileData.data || profileData, source: profileData.source || 'svg'};
}

// 从GitHub用户页面获取贡献数据（备用方案）
async function fetchGitHubContributionsFromProfile(username) {
    console.log('尝试从GitHub SVG贡献图获取数据...');
    
    try {
        // 尝试获取GitHub的贡献图SVG
        const svgUrl = `https://github.com/users/${username}/contributions`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(svgUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const data = await response.json();
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // 解析SVG中的贡献数据
            const contributions = parseSVGContributions(doc);
            if (contributions.length > 0) {
                console.log('成功从GitHub SVG获取贡献数据');
                return {data: contributions, source: 'svg'};
            }
        }
    } catch (error) {
        console.warn('SVG解析失败:', error);
    }
    
    // 最终备用方案：生成基于真实模式的数据
    console.log('使用智能生成的贡献数据...');
    return {data: generateRealisticContributions(username), source: 'generated'};
}

// 解析GitHub SVG贡献图
function parseSVGContributions(doc) {
    const contributions = [];
    
    try {
        // 查找贡献图中的数据
        const rects = doc.querySelectorAll('rect[data-date]');
        
        rects.forEach(rect => {
            const date = rect.getAttribute('data-date');
            const count = parseInt(rect.getAttribute('data-count') || '0');
            const level = parseInt(rect.getAttribute('data-level') || '0');
            
            if (date) {
                contributions.push({
                    date: date,
                    count: count,
                    level: Math.min(level, 4) // 确保level在0-4范围内
                });
            }
        });
        
        // 如果没找到data-date属性，尝试其他方式
        if (contributions.length === 0) {
            const contributionDays = doc.querySelectorAll('.ContributionCalendar-day');
            contributionDays.forEach(day => {
                const date = day.getAttribute('data-date');
                const level = day.getAttribute('data-level');
                const count = estimateCountFromLevel(parseInt(level || '0'));
                
                if (date) {
                    contributions.push({
                        date: date,
                        count: count,
                        level: parseInt(level || '0')
                    });
                }
            });
        }
        
    } catch (error) {
        console.error('解析SVG贡献数据失败:', error);
    }
    
    return contributions;
}

// 根据level估算count
function estimateCountFromLevel(level) {
    switch (level) {
        case 0: return 0;
        case 1: return Math.floor(Math.random() * 3) + 1; // 1-3
        case 2: return Math.floor(Math.random() * 4) + 4; // 4-7
        case 3: return Math.floor(Math.random() * 5) + 8; // 8-12
        case 4: return Math.floor(Math.random() * 10) + 13; // 13-22
        default: return 0;
    }
}

// 生成更真实的贡献数据（基于真实GitHub用户模式）
function generateRealisticContributions(username) {
    const contributions = [];
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // 基于用户名生成一致的随机种子
    let seed = 0;
    for (let i = 0; i < username.length; i++) {
        seed += username.charCodeAt(i);
    }
    
    // 简单的伪随机数生成器
    function seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    let currentSeed = seed;
    
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
        currentSeed++;
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        
        // 创建更真实的模式
        let baseActivity = 0.4;
        
        // 工作日更活跃
        if (!isWeekend) {
            baseActivity = 0.7;
        }
        
        // 模拟假期和忙碌期
        if (dayOfYear > 350 || dayOfYear < 15) { // 年末年初
            baseActivity *= 0.3;
        } else if (dayOfYear > 150 && dayOfYear < 180) { // 夏季
            baseActivity *= 0.6;
        }
        
        // 模拟项目冲刺期
        const sprintCycle = Math.floor(dayOfYear / 14) % 4;
        if (sprintCycle === 0) {
            baseActivity *= 1.5; // 冲刺期
        } else if (sprintCycle === 3) {
            baseActivity *= 0.7; // 休息期
        }
        
        const rand = seededRandom(currentSeed);
        const hasContribution = rand < baseActivity;
        
        let count = 0;
        if (hasContribution) {
            const intensityRand = seededRandom(currentSeed + 1000);
            if (intensityRand < 0.05) {
                count = Math.floor(seededRandom(currentSeed + 2000) * 25) + 15; // 超高活跃
            } else if (intensityRand < 0.2) {
                count = Math.floor(seededRandom(currentSeed + 3000) * 12) + 8; // 高活跃
            } else if (intensityRand < 0.5) {
                count = Math.floor(seededRandom(currentSeed + 4000) * 6) + 3; // 中等活跃
            } else {
                count = Math.floor(seededRandom(currentSeed + 5000) * 3) + 1; // 低活跃
            }
        }
        
        contributions.push({
            date: new Date(d).toISOString().split('T')[0],
            count: count,
            level: getContributionLevel(count)
        });
    }
    
    console.log(`为用户 ${username} 生成了 ${contributions.length} 天的贡献数据`);
    return contributions;
}

// 生成模拟贡献数据
function generateMockContributions() {
    const contributions = [];
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // 工作日有更高的贡献概率
        const baseChance = isWeekend ? 0.3 : 0.7;
        const hasContribution = Math.random() < baseChance;
        
        let count = 0;
        if (hasContribution) {
            // 随机生成贡献数量，偶尔有高峰
            const rand = Math.random();
            if (rand < 0.1) count = Math.floor(Math.random() * 20) + 10; // 高峰期
            else if (rand < 0.4) count = Math.floor(Math.random() * 8) + 3; // 中等活跃
            else count = Math.floor(Math.random() * 3) + 1; // 低活跃
        }
        
        contributions.push({
            date: new Date(d).toISOString().split('T')[0],
            count: count,
            level: getContributionLevel(count)
        });
    }
    
    return contributions;
}

// 根据贡献数量获取等级
function getContributionLevel(count) {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
}

// 按周组织贡献数据 - GitHub风格
function organizeDataByWeeks(contributions) {
    // 创建日期映射以便快速查找
    const dataMap = new Map();
    contributions.forEach(item => {
        dataMap.set(item.date, item);
    });
    
    // 计算一年前的日期（从周日开始）
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // 找到开始日期的周日
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // 找到结束日期的周六（当前周）
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        const dayData = dataMap.get(dateString) || {
            date: dateString,
            count: 0,
            level: 0
        };
        
        currentWeek.push(dayData);
        
        // 如果是周六，完成当前周
        if (currentDate.getDay() === 6) {
            weeks.push([...currentWeek]);
            currentWeek = [];
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 处理最后一周（如果未完成）
    if (currentWeek.length > 0) {
        // 补齐最后一周到7天
        while (currentWeek.length < 7) {
            const nextDate = new Date(currentDate);
            const nextDateString = nextDate.toISOString().split('T')[0];
            currentWeek.push({
                date: nextDateString,
                count: 0,
                level: 0
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        weeks.push(currentWeek);
    }
    
    return weeks;
}

// 更新贡献图表
function updateContributionChart(contributions, dataSource = 'unknown') {
    const chartContainer = document.getElementById('contribution-chart');
    if (!chartContainer) return;
    
    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768;
    
    chartContainer.innerHTML = '';
    
    // 按周组织数据 - GitHub风格
    const weeklyData = organizeDataByWeeks(contributions);
    
    // 将标题行内容移到标题占位符中
    const headerPlaceholder = document.getElementById('contribution-header-placeholder');
    const titleElement = document.getElementById('contribution-title');
    
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = '';
        
        if (isMobile) {
            // 手机端：只将标题移到占位符中，添加统计数据
            if (titleElement) {
                const titleClone = titleElement.cloneNode(true);
                titleElement.style.display = 'none'; // 隐藏原标题
                headerPlaceholder.appendChild(titleClone);
            }
            
            const mobileStats = createMobileStats(contributions);
            headerPlaceholder.appendChild(mobileStats);
            
            // 手机端不显示贡献图，直接返回
            return;
        } else {
            // 桌面端：显示原标题，添加图例和数据源信息
            if (titleElement) {
                titleElement.style.display = 'inline'; // 显示原标题
            }
            
            const headerRow = createContributionHeader(dataSource);
            headerPlaceholder.appendChild(headerRow);
        }
    }
    
    // 创建月份标签
    const monthLabels = createMonthLabels(weeklyData);
    chartContainer.appendChild(monthLabels);
    
    // 创建贡献格子容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'contribution-grid-container';
    
    // 创建星期标签
    const weekLabels = createWeekLabels();
    gridContainer.appendChild(weekLabels);
    
    // 创建贡献格子
    const grid = document.createElement('div');
    grid.className = 'contribution-grid';
    
    // 设置网格列数为实际周数，根据屏幕大小调整
    const isSmallMobile = window.innerWidth <= 480;
    const cellSize = isSmallMobile ? '9px' : '14px';
    grid.style.gridTemplateColumns = `repeat(${weeklyData.length}, ${cellSize})`;
    
    // 按周填充数据
    weeklyData.forEach((week, weekIndex) => {
        week.forEach((day, dayIndex) => {
            const cell = document.createElement('div');
            cell.className = `contribution-cell level-${day.level}`;
            cell.title = `${day.date}: ${day.count} 次贡献`;
            cell.setAttribute('data-count', day.count);
            cell.setAttribute('data-date', day.date);
            
            // 添加延迟动画
            cell.style.animationDelay = `${(weekIndex * 7 + dayIndex) * 2}ms`;
            
            // 鼠标悬停效果
            cell.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.3)';
                this.style.zIndex = '10';
                
                // 显示工具提示
                showTooltip(this, day);
            });
            
            cell.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.zIndex = '1';
                // 不在mouseleave时立即隐藏，让工具提示有时间显示
            });
            
            // 点击时隐藏所有工具提示
            cell.addEventListener('click', function() {
                hideAllTooltips();
            });
            
            grid.appendChild(cell);
        });
    });
    
    gridContainer.appendChild(grid);
    chartContainer.appendChild(gridContainer);
    
    // 创建统计摘要
    const summary = createContributionSummary(contributions);
    chartContainer.appendChild(summary);
    
    // 触发入场动画
    setTimeout(() => {
        chartContainer.classList.add('chart-loaded');
    }, 100);
}

// 获取数据源指示器样式
function getSourceIndicatorClass(dataSource) {
    switch (dataSource) {
        case 'api': return 'source-api';
        case 'svg': return 'source-svg';
        case 'generated': return 'source-generated';
        default: return 'source-unknown';
    }
}

// 获取数据源文本
function getSourceText(dataSource) {
    switch (dataSource) {
        case 'api': return '实时数据';
        case 'svg': return '解析数据';
        case 'generated': return '智能生成';
        default: return '数据加载中';
    }
}

// 创建贡献摘要
function createContributionSummary(contributions) {
    const summary = document.createElement('div');
    summary.className = 'contribution-summary';
    
    const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);
    const activeDays = contributions.filter(day => day.count > 0).length;
    const maxDay = contributions.reduce((max, day) => day.count > max.count ? day : max, contributions[0]);
    
    summary.innerHTML = `
        <div class="summary-item">
            <span class="summary-number">${totalContributions.toLocaleString()}</span>
            <span class="summary-label">总贡献</span>
        </div>
        <div class="summary-item">
            <span class="summary-number">${activeDays}</span>
            <span class="summary-label">活跃天数</span>
        </div>
        <div class="summary-item">
            <span class="summary-number">${maxDay.count}</span>
            <span class="summary-label">单日最高</span>
        </div>
        <div class="summary-item">
            <span class="summary-number">${Math.round((activeDays / contributions.length) * 100)}%</span>
            <span class="summary-label">活跃率</span>
        </div>
    `;
    
    return summary;
}

// 创建月份标签
function createMonthLabels(weeklyData) {
    const monthsContainer = document.createElement('div');
    monthsContainer.className = 'month-labels';
    
    if (!weeklyData || weeklyData.length === 0) {
        return monthsContainer;
    }
    
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthPositions = [];
    
    // 计算每个月份在网格中的位置
    weeklyData.forEach((week, weekIndex) => {
        if (week.length > 0) {
            const firstDayOfWeek = new Date(week[0].date);
            const month = firstDayOfWeek.getMonth();
            const day = firstDayOfWeek.getDate();
            
            // 如果是月初的前几天，显示月份标签
            if (day <= 7 && !monthPositions.find(m => m.month === month)) {
                monthPositions.push({
                    month: month,
                    weekIndex: weekIndex,
                    label: months[month]
                });
            }
        }
    });
    
    // 创建月份标签容器，宽度与网格对应
    const isSmallMobile = window.innerWidth <= 480;
    const cellSize = isSmallMobile ? '9px' : '14px';
    const labelSize = isSmallMobile ? '18px' : '22px';
    
    monthsContainer.style.display = 'grid';
    monthsContainer.style.gridTemplateColumns = `${labelSize} repeat(${weeklyData.length}, ${cellSize})`;
    monthsContainer.style.gap = '3px';
    monthsContainer.style.marginBottom = '8px';
    
    // 添加空白占位符（对应周标签的位置）
    const spacer = document.createElement('span');
    monthsContainer.appendChild(spacer);
    
    // 为每周添加月份标签或空白
    for (let i = 0; i < weeklyData.length; i++) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'month-label';
        
        const monthPos = monthPositions.find(m => m.weekIndex === i);
        if (monthPos) {
            monthLabel.textContent = monthPos.label;
        }
        
        monthsContainer.appendChild(monthLabel);
    }
    
    return monthsContainer;
}

// 创建星期标签
function createWeekLabels() {
    const weekContainer = document.createElement('div');
    weekContainer.className = 'week-labels';
    
    const days = ['', '周一', '', '周三', '', '周五', ''];
    days.forEach(day => {
        const dayLabel = document.createElement('span');
        dayLabel.className = 'week-label';
        dayLabel.textContent = day;
        weekContainer.appendChild(dayLabel);
    });
    
    return weekContainer;
}

// 创建贡献图标题行（包含数据源和图例）
function createContributionHeader(dataSource) {
    const headerRow = document.createElement('div');
    headerRow.className = 'contribution-header-row';
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // 手机端：不显示任何内容，只返回空的headerRow
        // 这样手机端就只有标题，没有图例和数据源信息
    } else {
        // 桌面端：显示图例和数据源信息
        // 中间：图例（少和多）
        const legend = document.createElement('div');
        legend.className = 'contribution-legend';
        
        const lessLabel = document.createElement('span');
        lessLabel.textContent = '少';
        lessLabel.className = 'legend-label';
        legend.appendChild(lessLabel);
        
        for (let i = 0; i <= 4; i++) {
            const levelCell = document.createElement('div');
            levelCell.className = `legend-cell level-${i}`;
            legend.appendChild(levelCell);
        }
        
        const moreLabel = document.createElement('span');
        moreLabel.textContent = '多';
        moreLabel.className = 'legend-label';
        legend.appendChild(moreLabel);
        
        // 右侧：数据源信息
        const sourceInfo = document.createElement('div');
        sourceInfo.className = 'contribution-source-info';
        sourceInfo.innerHTML = `
            <span class="source-indicator ${getSourceIndicatorClass(dataSource)}"></span>
            <span class="source-text">${getSourceText(dataSource)}</span>
        `;
        
        headerRow.appendChild(legend);
        headerRow.appendChild(sourceInfo);
    }
    
    return headerRow;
}

// 创建手机端统计信息
function createMobileStats(contributions) {
    const mobileStats = document.createElement('div');
    mobileStats.className = 'mobile-contribution-stats';
    
    const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);
    const activeDays = contributions.filter(day => day.count > 0).length;
    const maxDay = contributions.reduce((max, day) => day.count > max.count ? day : max, contributions[0]);
    const activityRate = Math.round((activeDays / contributions.length) * 100);
    
    mobileStats.innerHTML = `
        <div class="mobile-stat-item">
            <span class="mobile-stat-number">${totalContributions.toLocaleString()}</span>
            <span class="mobile-stat-label">总贡献</span>
        </div>
        <div class="mobile-stat-item">
            <span class="mobile-stat-number">${activeDays}</span>
            <span class="mobile-stat-label">活跃天数</span>
        </div>
        <div class="mobile-stat-item">
            <span class="mobile-stat-number">${maxDay.count}</span>
            <span class="mobile-stat-label">单日最高</span>
        </div>
        <div class="mobile-stat-item">
            <span class="mobile-stat-number">${activityRate}%</span>
            <span class="mobile-stat-label">活跃率</span>
        </div>
    `;
    
    return mobileStats;
}

// 工具提示节流变量
let tooltipTimeout = null;

// 显示工具提示
function showTooltip(element, contribution) {
    // 清除之前的延时
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
    
    // 先清理所有现有的工具提示
    hideAllTooltips();
    
    // 延时显示，避免快速移动时频繁创建
    tooltipTimeout = setTimeout(() => {
        const tooltip = document.createElement('div');
        tooltip.className = 'contribution-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-date">${formatTooltipDate(contribution.date)}</div>
            <div class="tooltip-count">${contribution.count} 次贡献</div>
        `;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 + 'px';
        tooltip.style.top = rect.top - 10 + 'px';
        
        document.body.appendChild(tooltip);
        
        // 动画显示
        setTimeout(() => tooltip.classList.add('show'), 10);
        
        // 2秒后自动隐藏
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.classList.remove('show');
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.remove();
                    }
                }, 200);
            }
        }, 2000);
    }, 100); // 100ms延时
}

// 隐藏单个工具提示
function hideTooltip() {
    const tooltips = document.querySelectorAll('.contribution-tooltip');
    tooltips.forEach(tooltip => {
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 200);
    });
}

// 隐藏所有工具提示
function hideAllTooltips() {
    const tooltips = document.querySelectorAll('.contribution-tooltip');
    tooltips.forEach(tooltip => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    });
}

// 格式化工具提示日期
function formatTooltipDate(dateString) {
    const date = new Date(dateString);
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return `${date.getFullYear()}年${months[date.getMonth()]}${date.getDate()}日`;
}

// 更新GitHub统计数据
function updateGitHubStats(contributions) {
    const totalCommits = contributions.reduce((sum, day) => sum + day.count, 0);
    const longestStreak = calculateLongestStreak(contributions);
    
    // 动画更新数字
    const totalElement = document.getElementById('total-commits');
    const streakElement = document.getElementById('longest-streak');
    
    if (totalElement) {
        animateNumber(totalElement, 0, totalCommits, 2000);
    }
    
    if (streakElement) {
        animateNumber(streakElement, 0, longestStreak, 1500);
    }
}

// 计算最长连续天数
function calculateLongestStreak(contributions) {
    let maxStreak = 0;
    let currentStreak = 0;
    
    contributions.forEach(day => {
        if (day.count > 0) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });
    
    return maxStreak;
}

// 数字动画函数
function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * easeOutCubic(progress));
        element.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// 缓动函数
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// 增强的技能图标悬停效果
function initSkillIcons() {
    const skillIcons = document.querySelectorAll('.skill-icon');
    
    skillIcons.forEach((icon, index) => {
        // 添加延迟加载动画
        icon.style.animationDelay = `${index * 0.1}s`;
        icon.classList.add('skill-icon-animate-in');
        
        icon.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) scale(1.15) rotate(5deg)';
            this.style.boxShadow = '0 15px 35px rgba(255, 255, 255, 0.3)';
            this.style.background = 'rgba(255, 255, 255, 0.25)';
            
            // // 添加粒子效果
            // createSkillParticles(this);
        });
        
        icon.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-3px) scale(1) rotate(0deg)';
            this.style.boxShadow = 'none';
            this.style.background = 'rgba(255, 255, 255, 0.1)';
        });
        
        // 添加点击波纹效果
        icon.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.className = 'ripple-effect';
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                margin-left: -10px;
                margin-top: -10px;
            `;
            
            this.style.position = 'relative';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// 修改后的卡片悬停效果
function initCardEffects() {
    const cards = document.querySelectorAll('.site-card, .project-card');
    
    cards.forEach((card, index) => {
        // 添加入场动画
        card.style.animationDelay = `${index * 0.15}s`;
        card.classList.add('card-animate-in');
        
        // 添加3D倾斜效果
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * 8;
            const rotateY = (centerX - x) / centerX * 8;
            
            this.style.transform = `translateY(-8px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
            this.style.boxShadow = '0 20px 40px rgba(255, 255, 255, 0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-3px) rotateX(0deg) rotateY(0deg) scale(1)';
            this.style.boxShadow = 'none';
        });
        
        // 添加点击动画
        card.addEventListener('click', function() {
            this.style.transform = 'translateY(-5px) scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'translateY(-8px) scale(1.03)';
            }, 150);
            
            // 添加点击波纹效果
            createCardRipple(this, event);
        });
    });
}

// 为卡片创建点击波纹效果
function createCardRipple(card, event) {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        animation: cardRipple 0.6s ease-out;
        pointer-events: none;
    `;
    
    card.style.position = 'relative';
    card.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// 添加CSS动画关键帧
function addAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @keyframes cardRipple {
            to {
                width: 200px;
                height: 200px;
                opacity: 0;
            }
        }
        
        @keyframes skillIconIn {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.8);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        @keyframes cardIn {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .skill-icon-animate-in {
            animation: skillIconIn 0.6s ease-out forwards;
        }
        
        .card-animate-in {
            animation: cardIn 0.8s ease-out forwards;
        }
        
        .github-stats {
            animation: fadeInUp 0.8s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// 添加平滑的滚动显示动画
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                // 为技能图标添加波浪式动画
                if (entry.target.classList.contains('skills-section')) {
                    const skillIcons = entry.target.querySelectorAll('.skill-icon');
                    skillIcons.forEach((icon, index) => {
                        setTimeout(() => {
                            icon.style.opacity = '1';
                            icon.style.transform = 'translateY(0) scale(1)';
                        }, index * 50);
                    });
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // 观察所有卡片元素
    document.querySelectorAll('.site-card, .project-card, .skills-section, .github-stats').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
}

// 添加打字机效果到引用文本
function initTypewriterEffect() {
    const quoteElement = document.querySelector('.quote span:last-child');
    if (quoteElement) {
        const text = quoteElement.innerHTML; // 保留HTML标签
        // 使用统一的打字机效果函数，延迟1秒开始
        typewriterTimeout = setTimeout(() => {
            // 只有在没有被API更新时才启动打字机效果
            if (!typewriterRunning) {
                startTypewriterEffect(quoteElement, text);
            }
        }, 1000);
    }
}

// 社交链接增强效果
function initSocialLinks() {
    const socialLinks = document.querySelectorAll('.social-links a');
    
    socialLinks.forEach((link, index) => {
        // 添加延迟动画
        link.style.animationDelay = `${index * 0.1}s`;
        link.classList.add('social-link-animate');
        
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.2) rotate(10deg)';
            this.style.boxShadow = '0 10px 25px rgba(255, 255, 255, 0.2)';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1) rotate(0deg)';
            this.style.boxShadow = 'none';
        });
        
        link.addEventListener('click', function(e) {
            // 只对夏日空调按钮（有onclick属性的）阻止默认行为
            if (this.hasAttribute('onclick')) {
                e.preventDefault();
            }
            
            // 创建点击波纹
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                margin-left: -10px;
                margin-top: -10px;
            `;
            
            this.style.position = 'relative';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
            
            console.log('Social link clicked:', this.querySelector('i').className);
        });
    });
    
    // 添加背景切换按钮到社交链接区域（仅在开关开启时）
    if (FEATURE_THEMA) {
        addBackgroundToggleToSocial();
    }
}

// 打开iframe显示ice文件夹中的index.html
let iframeContainer = null; // 全局变量追踪iframe状态

function showIframe() {
    // 如果iframe已经存在，则关闭它
    if (iframeContainer && document.body.contains(iframeContainer)) {
        closeIframe();
        return;
    }
    
    // 创建iframe容器
    iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 400px;
        height: 720px;
        background: rgb(255 255 255 / 71%);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 15px;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;
    
    // 创建iframe
    const iframe = document.createElement('iframe');
    iframe.height = "240";
    iframe.src = "https://home.loadke.tech/ice/";
    iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 10px;
        margin-top: 30px;
    `;
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: #28487a;
        font-size: 20px;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease;
    `;
    
    closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 255, 255, 0.3)';
        this.style.transform = 'scale(1.1)';
    });
    
    closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
        this.style.transform = 'scale(1)';
    });
    
    // 关闭功能
    closeBtn.addEventListener('click', closeIframe);
    
    // ESC键关闭
    const escHandler = function(e) {
        if (e.key === 'Escape' && iframeContainer && document.body.contains(iframeContainer)) {
            closeIframe();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // 组装并显示
    iframeContainer.appendChild(iframe);
    iframeContainer.appendChild(closeBtn);
    document.body.appendChild(iframeContainer);
    
    // 添加进入动画
    iframeContainer.style.opacity = '0';
    iframeContainer.style.animation = 'fadeIn 0.3s ease-out forwards';
    
    // 添加动画样式
    if (!document.getElementById('iframe-animations')) {
        const style = document.createElement('style');
        style.id = 'iframe-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }
}

function closeIframe() {
    if (iframeContainer && document.body.contains(iframeContainer)) {
        iframeContainer.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(iframeContainer)) {
                document.body.removeChild(iframeContainer);
            }
            iframeContainer = null; // 重置状态
        }, 300);
    }
}


// 访客IP地址获取功能
function fetchVisitorIP() {
    // 使用自己的API获取IP地址和地理位置信息
    fetch(API_BASE_URL + '/api/visitor-ip')
        .then(response => response.json())
        .then(data => {
            const ipElement = document.getElementById('visitor-ip');
            if (ipElement) {
                if (data.displayText) {
                    ipElement.innerHTML = data.displayText;
                } else if (data.ip) {
                    ipElement.textContent = data.ip;
                } else {
                    ipElement.textContent = '无法获取IP地址';
                }
            }
        })
        .catch(error => {
            console.error('获取IP地址失败:', error);
            const ipElement = document.getElementById('visitor-ip');
            if (ipElement) {
                ipElement.textContent = '无法获取IP地址';
            }
        });
}

// 时间线增强动画
function initTimelineAnimation() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    const timelineObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateX(0)';
                    
                    // 为时间线点添加脉冲效果
                    const dot = entry.target.querySelector('.timeline-dot');
                    dot.style.animation = 'pulse 1s ease-in-out';
                }, index * 200);
            }
        });
    }, { threshold: 0.1 });
    
    timelineItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        item.style.transition = 'all 0.5s ease-out';
        timelineObserver.observe(item);
    });
}

// 添加脉冲动画样式
function addPulseAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.5); box-shadow: 0 0 20px rgba(116, 185, 255, 0.6); }
            100% { transform: scale(1); }
        }
        
        @keyframes socialLinkIn {
            from {
                opacity: 0;
                transform: translateY(20px) rotate(-10deg);
            }
            to {
                opacity: 1;
                transform: translateY(0) rotate(0deg);
            }
        }
        
        .social-link-animate {
            animation: socialLinkIn 0.6s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}

// 添加粒子背景效果
function createParticles() {
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            width: ${2 + Math.random() * 3}px;
            height: ${2 + Math.random() * 3}px;
            background: rgba(255, 255, 255, ${0.3 + Math.random() * 0.4});
            border-radius: 50%;
            pointer-events: none;
            z-index: -1;
            left: ${Math.random() * 100}vw;
            top: ${Math.random() * 100}vh;
            animation: particleFloat ${3 + Math.random() * 4}s ease-in-out infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        
        document.body.appendChild(particle);
    }
    
    // 添加粒子动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0%, 100% { 
                transform: translateY(0px) translateX(0px) rotate(0deg);
                opacity: 0.3;
            }
            25% { 
                transform: translateY(-20px) translateX(10px) rotate(90deg);
                opacity: 1;
            }
            50% { 
                transform: translateY(-10px) translateX(-10px) rotate(180deg);
                opacity: 0.5;
            }
            75% { 
                transform: translateY(-30px) translateX(5px) rotate(270deg);
                opacity: 0.8;
            }
        }
    `;
    document.head.appendChild(style);
}

// 获取API数据并更新页面
async function fetchDataAndUpdatePage() {
    try {
        const response = await fetch(API_BASE_URL + '/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const data = result.data;
        
        // 更新GitHub用户名
        if (data.github) {
            GITHUB_USERNAME = data.github;
            console.log('GitHub用户名已更新为:', GITHUB_USERNAME);
        }
        
        // 设置功能开关
        FEATURE_ICE = !!data.ice;
        FEATURE_THEMA = !!data.thema;
        
        // 更新各个部分
        updateTimelineFromAPI(data.timelineData);
        updateProjects(data.projectsData);
        updateSites(data.sitesData);
        updateSkillsFromAPI(data.skillsData);
        updateSocialLinksFromAPI(data.socialData);
        updateTags(data.tagsData);
        updateImages(data.imagesData);
        updateQuote(data.quoteData);
        updateWebInfo(data.web_info);
        updateProfileInfo(data.profileData);
        updateLocationInfo(data.locationData);
        
        console.log('页面数据更新成功');
        
        // 在获取API数据并更新GitHub用户名后，再获取GitHub统计数据
        fetchGitHubContributions(GITHUB_USERNAME);
        
        // 重新初始化动画和交互效果（针对动态添加的元素）
        setTimeout(() => {
            reinitializeEffects();
        }, 100);
        
    } catch (error) {
        console.error('获取API数据失败:', error);
        // 如果API失败，使用默认的GitHub用户名获取数据
        fetchGitHubContributions(GITHUB_USERNAME);
        
        // 即使API失败，也要初始化现有元素的效果
        setTimeout(() => {
            reinitializeEffects();
        }, 100);
    }
}

// 更新时间线
function updateTimelineFromAPI(timelineData) {
    if (!timelineData || !Array.isArray(timelineData)) return;
    
    const timelineSection = document.querySelector('.timeline-section');
    if (!timelineSection) return;
    
    timelineSection.innerHTML = '';
    
    timelineData.forEach(item => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        timelineItem.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-title">${item.title}</div>
                <div class="timeline-date">${formatDateAPI(item.date)}</div>
            </div>
        `;
        timelineSection.appendChild(timelineItem);
    });
}

// 更新项目展示
function updateProjects(projectsData) {
    if (!projectsData || !Array.isArray(projectsData)) return;
    
    const projectsGrid = document.querySelector('.projects-grid');
    if (!projectsGrid) return;
    
    projectsGrid.innerHTML = '';
    
    projectsData.forEach(project => {
        const projectLink = document.createElement('a');
        projectLink.href = project.url;
        projectLink.target = '_blank';
        projectLink.className = 'project-link btn-effect';
        projectLink.innerHTML = `
            <div class="project-card">
                <div class="project-icon">
                    ${(project.icon.startsWith('fa') || project.icon.includes('fa-')) ? 
                        `<i class="${project.icon}"></i>` : 
                        `<img src="${project.icon}" alt="${project.name}">`
                    }
                </div>
                <div class="project-info">
                    <h3>${project.name}</h3>
                    <p>${project.desc}</p>
                </div>
            </div>
        `;
        projectsGrid.appendChild(projectLink);
    });
}

// 更新站点展示
function updateSites(sitesData) {
    if (!sitesData || !Array.isArray(sitesData)) return;
    
    const sitesGrid = document.querySelector('.sites-grid');
    if (!sitesGrid) return;
    
    sitesGrid.innerHTML = '';
    
    sitesData.forEach(site => {
        const siteLink = document.createElement('a');
        siteLink.href = site.url;
        siteLink.target = '_blank';
        siteLink.className = 'site-link btn-effect';
        siteLink.innerHTML = `
            <div class="site-card">
                <div class="site-icon">
                    ${(site.icon.startsWith('fa') || site.icon.includes('fa-')) ? 
                        `<i class="${site.icon}"></i>` : 
                        `<img src="${site.icon}" alt="${site.name}">`
                    }
                </div>
                <div class="site-info">
                    <h3>${site.name}</h3>
                    <p>${site.desc}</p>
                </div>
            </div>
        `;
        sitesGrid.appendChild(siteLink);
    });
}

// 更新技能展示
function updateSkillsFromAPI(skillsData) {
    if (!skillsData || !Array.isArray(skillsData)) return;
    
    const skillsIcons = document.querySelector('.skills-icons');
    if (!skillsIcons) return;
    
    skillsIcons.innerHTML = '';
    
    skillsData.forEach(skill => {
        const skillIcon = document.createElement('div');
        skillIcon.className = 'skill-icon';
        skillIcon.title = skill.name;
        skillIcon.innerHTML = (skill.icon.startsWith('fa') || skill.icon.includes('fa-')) ? 
            `<i class="${skill.icon}"></i>` : 
            `<img src="${skill.icon}" alt="${skill.name}">`;
        skillsIcons.appendChild(skillIcon);
    });
}

// 更新社交链接
function updateSocialLinksFromAPI(socialData) {
    if (!socialData || !Array.isArray(socialData)) return;
    
    const socialLinks = document.querySelector('.social-links');
    if (!socialLinks) return;
    
    // 保留最后一个链接（夏日空调），只替换前面的社交链接
    const lastLink = socialLinks.querySelector('a[onclick]');
    socialLinks.innerHTML = '';
    
    socialData.forEach(social => {
        const link = document.createElement('a');
        link.href = social.url;
        link.target = '_blank';
        link.innerHTML = `<i class="${social.ico}"></i>`;
        socialLinks.appendChild(link);
    });
    
    // 重新添加夏日空调链接（仅在开关开启时）
    if (lastLink && FEATURE_ICE) {
        socialLinks.appendChild(lastLink);
    }
    
    // 添加背景切换按钮到社交链接区域（仅在开关开启时）
    if (FEATURE_THEMA) {
        addBackgroundToggleToSocial();
    }
}
const terData = ['aHR0cHM6Ly9ibG9nLmxvYWRrZS50ZWNoLw=='];
function loterData() {
    try {
        const rl = atob(terData[0]);
        const lk = document.getElementById('footer-link');
        if (lk) {
            lk.href = rl;
            setInterval(() => {
                if (lk.href !== rl) {
                    lk.href = rl;
                }
            }, 3000);
        }
    } catch (e) {
    }
}

document.addEventListener('DOMContentLoaded', function() {
    detectDevTools();
    loterData();
});

// 更新标签
function updateTags(tagsData) {
    if (!tagsData || !Array.isArray(tagsData)) return;
    
    const tagsSection = document.querySelector('.tags-section');
    if (!tagsSection) return;
    
    tagsSection.innerHTML = '';
    
    tagsData.forEach(tagText => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = tagText;
        tagsSection.appendChild(tag);
    });
}

// 更新图片（头像和背景）
function updateImages(imagesData) {
    if (!imagesData || !Array.isArray(imagesData)) return;
    
    imagesData.forEach(imageItem => {
        // 更新头像
        if (imageItem.avatar) {
            const avatarImg = document.querySelector('.profile-avatar img');
            if (avatarImg) {
                avatarImg.src = imageItem.avatar;
                console.log('头像已更新为:', imageItem.avatar);
            }
        }
        
        // 更新背景图片
        if (imageItem.bg_image) {
            // 保存背景图片到localStorage
            const backgroundInfo = {
                background: `linear-gradient(135deg, rgba(30, 60, 114, 0.9) 0%, rgba(42, 82, 152, 0.8) 50%, rgba(102, 126, 234, 0.7) 100%), url(${imageItem.bg_image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            };
            localStorage.setItem('background-info', JSON.stringify(backgroundInfo));
            // 只在非暗色模式下立即设置背景
            if (!document.body.classList.contains('dark-background')) {
                document.body.style.background = backgroundInfo.background;
                document.body.style.backgroundSize = backgroundInfo.backgroundSize;
                document.body.style.backgroundPosition = backgroundInfo.backgroundPosition;
                document.body.style.backgroundAttachment = backgroundInfo.backgroundAttachment;
            }
            // console.log('背景图片已更新并保存为:', imageItem.bg_image);
        }
    });
}

// 全局变量，跟踪打字机状态
let typewriterRunning = false;
let typewriterTimeout = null;

// 更新引用文本
function updateQuote(quoteData) {
    if (!quoteData) return;
    
    const quoteElement = document.querySelector('.quote span:last-child');
    if (!quoteElement) return;
    
    let finalText = '';
    
    // 如果是字符串，直接使用
    if (typeof quoteData === 'string') {
        finalText = quoteData;
    }
    // 如果是对象，支持更复杂的格式
    else if (typeof quoteData === 'object' && quoteData.text) {
        // 支持带高亮的文本格式
        let htmlText = quoteData.text;
        
        // 处理高亮文本
        if (quoteData.highlights && Array.isArray(quoteData.highlights)) {
            quoteData.highlights.forEach(highlight => {
                const regex = new RegExp(`\\b${highlight.word}\\b`, 'g');
                htmlText = htmlText.replace(regex, `<span class="highlight-${highlight.color}">${highlight.word}</span>`);
            });
        }
        
        finalText = htmlText;
    }
    
    if (finalText) {
        // 标记打字机已被API更新，阻止原有的打字机效果
        typewriterRunning = true;
        
        // 清除可能存在的延时
        if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
        }
        
        // 重新触发打字机效果
        startTypewriterEffect(quoteElement, finalText);
        console.log('引用文本已更新并启动打字机效果:', finalText);
    }
}

// 打字机效果函数（从原有的initTypewriterEffect中提取）
function startTypewriterEffect(element, text) {
    // 标记打字机正在运行
    typewriterRunning = true;
    
    // 清空元素内容
    element.innerHTML = '';
    let i = 0;
    
    function typeWriter() {
        if (i < text.length) {
            element.innerHTML = text.substring(0, i + 1);
            i++;
            setTimeout(typeWriter, 50);
        } else {
            // 打字机效果完成，重置状态
            typewriterRunning = false;
        }
    }
    
    // 稍微延迟开始打字机效果
    setTimeout(typeWriter, 500);
}

// 更新网页信息（标题和图标）
function updateWebInfo(webInfo) {
    if (!webInfo) return;
    
    // 更新网页标题
    if (webInfo.title) {
        document.title = webInfo.title;
        console.log('网页标题已更新为:', webInfo.title);
    }
    
    // 更新网页图标
    if (webInfo.icon) {
        // 查找现有的favicon链接
        let faviconLink = document.querySelector('link[rel="shortcut icon"]') || 
                         document.querySelector('link[rel="icon"]');
        
        if (faviconLink) {
            // 更新现有的favicon
            faviconLink.href = webInfo.icon;
        } else {
            // 创建新的favicon链接
            faviconLink = document.createElement('link');
            faviconLink.rel = 'shortcut icon';
            faviconLink.href = webInfo.icon;
            document.head.appendChild(faviconLink);
        }
        
        console.log('网页图标已更新为:', webInfo.icon);
    }
}

// 更新个人信息
function updateProfileInfo(profileData) {
    if (!profileData) return;
    
    // 更新状态标题
    if (profileData.statusTitle) {
        const titleElement = document.querySelector('.status .title');
        if (titleElement) {
            titleElement.textContent = profileData.statusTitle;
            console.log('状态标题已更新为:', profileData.statusTitle);
        }
    }
    
    // 更新状态表情
    if (profileData.statusEmoji) {
        const emojiElement = document.querySelector('.status .emoji');
        if (emojiElement) {
            emojiElement.textContent = profileData.statusEmoji;
            console.log('状态表情已更新为:', profileData.statusEmoji);
        }
    }
    
    // 更新头像装饰
    if (profileData.avatarDecorations && Array.isArray(profileData.avatarDecorations)) {
        const decorationsContainer = document.querySelector('.avatar-decorations');
        if (decorationsContainer) {
            decorationsContainer.innerHTML = '';
            profileData.avatarDecorations.forEach((decoration, index) => {
                const decorationDiv = document.createElement('div');
                decorationDiv.className = `decoration decoration-${index + 1}`;
                decorationDiv.textContent = decoration;
                decorationsContainer.appendChild(decorationDiv);
            });
            console.log('头像装饰已更新为:', profileData.avatarDecorations);
        }
    }
}

// 更新位置信息
function updateLocationInfo(locationData) {
    if (!locationData) return;
    
    // 更新位置
    if (locationData.place) {
        const locationElement = document.querySelector('.location span:last-child');
        if (locationElement) {
            locationElement.textContent = locationData.place;
            console.log('位置已更新为:', locationData.place);
        }
    }
    
    // 更新工作状态
    if (locationData.workStatus) {
        const workStatusElement = document.querySelector('.name span:last-child');
        if (workStatusElement) {
            workStatusElement.textContent = locationData.workStatus;
            console.log('工作状态已更新为:', locationData.workStatus);
        }
    }
}

// 格式化日期（API版本）
function formatDateAPI(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}.${month}`;
}

// 重新初始化动态添加元素的效果
function reinitializeEffects() {
    // 检测是否为真正的移动设备（只有移动设备且屏幕小）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.innerWidth <= 768;
    
    // 社交链接在所有设备上都需要重新初始化
    initSocialLinks();
    
    if (!isMobile) {
        // 重新应用其他效果到新添加的元素
        initSkillIcons();
        initCardEffects();
        initTimelineAnimation();
        initScrollAnimations();
    }
    
    console.log('动态元素效果已重新初始化');
}

// 添加贡献图的滚动显示动画
function initContributionAnimation() {
    const contributionSection = document.querySelector('.contribution-section');
    if (!contributionSection) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                // 触发贡献格子的波浪式动画
                setTimeout(() => {
                    const cells = entry.target.querySelectorAll('.contribution-cell');
                    cells.forEach((cell, index) => {
                        setTimeout(() => {
                            cell.style.animationDelay = '0s';
                            cell.classList.add('cell-wave-animation');
                        }, index * 3);
                    });
                }, 500);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    contributionSection.style.opacity = '0';
    contributionSection.style.transform = 'translateY(20px)';
    contributionSection.style.transition = 'all 0.6s ease-out';
    observer.observe(contributionSection);
}

// 背景切换功能
function initBackgroundToggle() {
    const toggleButton = document.getElementById('background-toggle');
    if (!toggleButton) return;
    
    // 保存原始背景设置
    let originalBackground = null;
    
    // 检查本地存储的背景模式
    const savedMode = localStorage.getItem('background-mode');
    if (savedMode === 'dark') {
        document.body.classList.add('dark-background');
        removeBodyBackground();
        updateToggleIcon(true);
    }
    
    toggleButton.addEventListener('click', function() {
        const isDark = document.body.classList.contains('dark-background');
        
        if (isDark) {
            // 切换到图片背景
            document.body.classList.remove('dark-background');
            restoreBodyBackground();
            localStorage.setItem('background-mode', 'image');
            updateToggleIcon(false);
        } else {
            // 切换到黑色背景
            document.body.classList.add('dark-background');
            removeBodyBackground();
            localStorage.setItem('background-mode', 'dark');
            updateToggleIcon(true);
        }
        
        // 添加切换动画效果
        toggleButton.style.transform = 'scale(0.8) rotate(180deg)';
        setTimeout(() => {
            toggleButton.style.transform = 'scale(1) rotate(0deg)';
        }, 200);
    });
    
    // 移除body背景
    function removeBodyBackground() {
        // 保存当前背景设置
        if (!originalBackground) {
            originalBackground = {
                background: document.body.style.background,
                backgroundSize: document.body.style.backgroundSize,
                backgroundPosition: document.body.style.backgroundPosition,
                backgroundAttachment: document.body.style.backgroundAttachment
            };
        }
        
        // 清除背景设置
        document.body.style.background = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundAttachment = '';
    }
    
    // 恢复body背景
    function restoreBodyBackground() {
        // 首先尝试从localStorage获取保存的背景信息
        const savedBackgroundInfo = localStorage.getItem('background-info');
        let backgroundToRestore = null;
        
        if (savedBackgroundInfo) {
            try {
                backgroundToRestore = JSON.parse(savedBackgroundInfo);
            } catch (e) {
                console.warn('解析保存的背景信息失败:', e);
            }
        }
        
        // 如果有保存的背景信息，使用它
        if (backgroundToRestore) {
            document.body.style.background = backgroundToRestore.background;
            document.body.style.backgroundSize = backgroundToRestore.backgroundSize;
            document.body.style.backgroundPosition = backgroundToRestore.backgroundPosition;
            document.body.style.backgroundAttachment = backgroundToRestore.backgroundAttachment;
        } else if (originalBackground) {
            // 否则使用运行时保存的背景
            document.body.style.background = originalBackground.background;
            document.body.style.backgroundSize = originalBackground.backgroundSize;
            document.body.style.backgroundPosition = originalBackground.backgroundPosition;
            document.body.style.backgroundAttachment = originalBackground.backgroundAttachment;
        } else {
            // 最后使用默认背景
            document.body.style.background = `
                linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.7) 100%)
            `;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }
}

// 更新切换按钮图标
function updateToggleIcon(isDark) {
    const toggleButton = document.getElementById('background-toggle');
    const icon = toggleButton.querySelector('i');
    
    if (isDark) {
        icon.className = 'fas fa-sun';
        toggleButton.title = '切换到图片背景';
    } else {
        icon.className = 'fas fa-moon';
        toggleButton.title = '切换到纯色背景';
    }
}

// 初始化所有功能
document.addEventListener('DOMContentLoaded', function() {
    addAnimationStyles();
    addPulseAnimation();
    
    // 初始化默认背景（如果不是暗色模式）
    const savedMode = localStorage.getItem('background-mode');
    if (savedMode !== 'dark') {
        // 尝试从localStorage获取保存的背景信息
        const savedBackgroundInfo = localStorage.getItem('background-info');
        let backgroundToSet = null;
        
        if (savedBackgroundInfo) {
            try {
                backgroundToSet = JSON.parse(savedBackgroundInfo);
            } catch (e) {
                console.warn('解析保存的背景信息失败:', e);
            }
        }
        
        if (backgroundToSet) {
            // 使用保存的背景信息
            document.body.style.background = backgroundToSet.background;
            document.body.style.backgroundSize = backgroundToSet.backgroundSize;
            document.body.style.backgroundPosition = backgroundToSet.backgroundPosition;
            document.body.style.backgroundAttachment = backgroundToSet.backgroundAttachment;
        } else {
            // 使用默认背景
            document.body.style.background = `
                linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.7) 100%)
            `;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }
    
    initBackgroundToggle();
    
    // 获取访客IP
    fetchVisitorIP();
    
    // 获取API数据并更新页面（包括GitHub用户名，然后获取GitHub统计数据）
    fetchDataAndUpdatePage();
    
    // 检测是否为真正的移动设备（只有移动设备且屏幕小）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.innerWidth <= 768;
    
    // 社交链接在所有设备上都需要初始化
    initSocialLinks();
    
    if (!isMobile) {
        // 只在非移动设备上加载其他动画
        initSkillIcons();
        initCardEffects();
        initScrollAnimations();
        initTypewriterEffect();
        createParticles();
        initTimelineAnimation();
        initContributionAnimation();
    } else {
        // 移动设备上也显示贡献图动画
        initContributionAnimation();
    }
    
    // 添加全局点击事件来隐藏工具提示
    document.addEventListener('click', function(e) {
        // 如果点击的不是贡献格子，就隐藏所有工具提示
        if (!e.target.classList.contains('contribution-cell')) {
            hideAllTooltips();
        }
    });
});

// 添加页面加载动画
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// 添加开发者工具检测和信息提示
function detectDevTools() {
    let devtools = false;
    
    // 检测开发者工具是否打开
    function checkDevTools() {
        const threshold = 160;
        
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devtools) {
                devtools = true;
                showDevToolsMessage();
            }
        } else {
            if (devtools) {
                devtools = false;
                hideDevToolsMessage();
            }
        }
    }
    
    // 显示开发者工具信息
    function showDevToolsMessage() {
        // 控制台输出样式化信息
        console.clear();
        console.log('%c🎉 欢迎来到我的个人主页！', 'color: #74b9ff; font-size: 20px; font-weight: bold;');
        console.log('%c👋 我的博客：https://blog.loadke.tech！', 'color: #00b894; font-size: 16px; font-weight: bold;');
        console.log('%c📧 联系我：https://t.me/IonMagic', 'color: #fdcb6e; font-size: 14px;');
        console.log('%c🌟 GitHub：https://github.com/IonRh', 'color: #e17055; font-size: 14px;');
        console.log('%c🚀 喜欢探索新技术，欢迎交流合作！', 'color: #fd79a8; font-size: 14px;');
        console.log('%c💡 个人使用，请保留出处哦~', 'color: #00cec9; font-size: 14px;');
        
        // 添加ASCII艺术
        console.log(`
%c  ██╗ ██████╗ ███╗   ██╗██████╗ ██╗  ██╗
  ██║██╔═══██╗████╗  ██║██╔══██╗██║  ██║
  ██║██║   ██║██╔██╗ ██║██████╔╝███████║
  ██║██║   ██║██║╚██╗██║██╔══██╗██╔══██║
  ██║╚██████╔╝██║ ╚████║██║  ██║██║  ██║
  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝
        `, 'color: #74b9ff; font-family: monospace;');
        
        // 页面右下角显示提示框
        createDevToolsNotification();
        
        // 检测右键和特定按键
        detectInspectActions();
    }
    
    function hideDevToolsMessage() {
        const notification = document.getElementById('devtools-notification');
        if (notification) {
            notification.remove();
        }
    }
    
    // 创建开发者工具通知
    function createDevToolsNotification() {
        // 移除已存在的通知
        const existingNotification = document.getElementById('devtools-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'devtools-notification';
        notification.innerHTML = `
            <div class="devtools-content">
                <div class="devtools-header">
                    <span>🛠️ 开发者模式</span>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="devtools-body">
                    <p>👋 你好，开发者朋友！</p>
                    <p>📧 联系：<a href="https://t.me/IonMagic">https://t.me/IonMagic</a></p>
                    <p>🌟 GitHub：<a href="https://github.com/IonRh" target="_blank">@IonRh</a></p>
                </div>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 15px;
            color: white;
            z-index: 10000;
            animation: slideInUp 0.5s ease-out;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        document.body.appendChild(notification);
        
        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutDown 0.5s ease-in';
                setTimeout(() => notification.remove(), 500);
            }
        }, 8000);
    }
    
    // 检测右键点击和检查元素
    function detectInspectActions() {
        // 检测右键菜单
        document.addEventListener('contextmenu', function(e) {
            console.log('%c🖱️ 检测到右键点击 - 准备查看源码？', 'color: #ffeaa7; font-size: 14px;');
        });
        
        // 检测F12按键
        document.addEventListener('keydown', function(e) {
            if (e.key === 'F12') {
                console.log('%c⌨️ F12 - 欢迎使用开发者工具！', 'color: #81ecec; font-size: 14px;');
            }
            
            // 检测Ctrl+Shift+I
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                console.log('%c⌨️ Ctrl+Shift+I - 开发者快捷键！', 'color: #fab1a0; font-size: 14px;');
            }
            
            // 检测Ctrl+U (查看源码)
            if (e.ctrlKey && e.key === 'u') {
                console.log('%c📄 查看页面源码 - 探索代码结构吧！', 'color: #ff7675; font-size: 14px;');
            }
        });
    }
    
    // 添加通知动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInUp {
            from {
                transform: translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutDown {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(100px);
                opacity: 0;
            }
        }
        
        #devtools-notification .devtools-content {
            padding: 15px;
        }
        
        #devtools-notification .devtools-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-weight: bold;
            font-size: 14px;
        }
        
        #devtools-notification .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.3s;
        }
        
        #devtools-notification .close-btn:hover {
            background: rgba(255,255,255,0.2);
        }
        
        #devtools-notification .devtools-body p {
            margin: 5px 0;
            font-size: 12px;
        }
        
        #devtools-notification .devtools-body a {
            color: #74b9ff;
            text-decoration: none;
        }
        
        #devtools-notification .devtools-body a:hover {
            text-decoration: underline;
        }
        
        #devtools-notification .tech-stack {
            margin-top: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        #devtools-notification .tech-tag {
            background: rgba(116, 185, 255, 0.2);
            color: #74b9ff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            border: 1px solid rgba(116, 185, 255, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // 定期检测开发者工具状态
    setInterval(checkDevTools, 500);
}

// 将背景切换功能放入社交那一排
 function addBackgroundToggleToSocial() {
     const socialLinksWrap = document.querySelector('.social-links');
     if (!socialLinksWrap) return;
 
     // 如果已存在旧的按钮，先移除，避免重复
     const existing = document.getElementById('background-toggle');
     if (existing && existing.parentElement) {
         existing.parentElement.removeChild(existing);
     }
 
     // 创建背景切换"链接"，与其他社交按钮保持一致
     const toggleLink = document.createElement('a');
     toggleLink.id = 'background-toggle';
     toggleLink.href = '#';
     toggleLink.title = '切换背景模式';
     toggleLink.innerHTML = '<i class="fas fa-moon"></i>';
 
     // 悬停效果与社交链接一致
     toggleLink.addEventListener('mouseenter', function() {
         this.style.transform = 'translateY(-5px) scale(1.2) rotate(10deg)';
         this.style.boxShadow = '0 10px 25px rgba(255, 255, 255, 0.2)';
     });
     toggleLink.addEventListener('mouseleave', function() {
         this.style.transform = 'translateY(0) scale(1) rotate(0deg)';
         this.style.boxShadow = 'none';
     });
 
     // 点击波纹效果，和其他社交链接一致
     toggleLink.addEventListener('click', function(e) {
         e.preventDefault();
         const ripple = document.createElement('div');
         ripple.style.cssText = `
             position: absolute;
             border-radius: 50%;
             background: rgba(255, 255, 255, 0.6);
             transform: scale(0);
             animation: ripple 0.6s linear;
             pointer-events: none;
             left: 50%;
             top: 50%;
             width: 20px;
             height: 20px;
             margin-left: -10px;
             margin-top: -10px;
         `;
         this.style.position = 'relative';
         this.appendChild(ripple);
         setTimeout(() => ripple.remove(), 600);
     });
 
     // 追加到容器中，保证夏日空调链接仍然在最后
     const lastSpecial = socialLinksWrap.querySelector('a[onclick]');
     if (lastSpecial) {
         // 放在夏日空调链接的右边（其后面）
         if (lastSpecial.nextSibling) {
             socialLinksWrap.insertBefore(toggleLink, lastSpecial.nextSibling);
         } else {
             socialLinksWrap.appendChild(toggleLink);
         }
     } else {
         socialLinksWrap.appendChild(toggleLink);
     }
 
     // 初始化切换逻辑（确保有按钮时再绑定事件）
     initBackgroundToggle();
 }

