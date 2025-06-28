// Wait for the HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    
    // --- GLOBAL STATE ---
    let activeFilter = null; // To track which stat card is active
    let lastResults = {}; // Store the results of the last calculation

    // --- ELEMENT REFERENCES ---
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsContainer = document.getElementById('results-content');
    const modal = document.getElementById('calculation-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    
    // --- MAIN CALCULATION EVENT ---
    calculateBtn.addEventListener('click', () => {
        clearHighlighting(); 
        activeFilter = null;

        const refStringInput = document.getElementById('reference-string').value.trim();
        const frameCount = parseInt(document.getElementById('frame-count').value, 10);
        const algorithm = document.getElementById('algorithm').value;
        const outputSection = document.getElementById('output-section');
        const errorMessageDiv = document.getElementById('error-message');
        const customSolutionDiv = document.getElementById('custom-solution-display');
        const referenceString = refStringInput.split(/\s+/).filter(n => n !== '').map(Number);

        outputSection.classList.add('hidden');
        errorMessageDiv.classList.add('hidden');
        customSolutionDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';

        if (referenceString.length === 0 || referenceString.some(isNaN)) {
            errorMessageDiv.textContent = 'Error: Please enter a valid, space-separated string of numbers.';
            errorMessageDiv.classList.remove('hidden');
            outputSection.classList.remove('hidden');
            document.getElementById('main-display').classList.add('hidden');
            return;
        }

        let mainResults, algorithmName;
        if (algorithm === 'fifo') {
            mainResults = runFIFO(referenceString, frameCount);
            algorithmName = "FIFO (First-In, First-Out)";
            document.getElementById('inputs-header').textContent = "Inputs (Standard FIFO)";

            // Run the special shifting algorithm for the second table
            const shiftingResults = runFifoShiftingAlgorithm(referenceString, frameCount, mainResults.steps);
            document.getElementById('custom-solution-display').querySelector('h3').textContent = "Solution (Shifting Visualization)";
            renderSolutionTable('custom-solution-table', shiftingResults.steps, referenceString, frameCount, false, false); // No status, no page row
            customSolutionDiv.classList.remove('hidden');

        } else { // LRU
            mainResults = runLRU(referenceString, frameCount);
            algorithmName = "LRU (Least Recently Used)";
            document.getElementById('inputs-header').textContent = "Inputs (Standard LRU)";
            
            // Run the special LRU recency visualization
            const shiftingResults = runLruShiftingAlgorithm(referenceString, frameCount, mainResults.steps);
            document.getElementById('custom-solution-display').querySelector('h3').textContent = "Solution (LRU Recency Visualization)";
            renderSolutionTable('custom-solution-table', shiftingResults.steps, referenceString, frameCount, false, false); // No status, no page row
            customSolutionDiv.classList.remove('hidden');
        }
        
        lastResults = { ...mainResults, total: referenceString.length };

        document.getElementById('main-header').textContent = algorithmName;
        renderSolutionTable('main-solution-table', mainResults.steps, referenceString, frameCount, true, true); // Include status and page row
        renderStatistics(mainResults.hits, mainResults.faults, referenceString.length);
        
        document.getElementById('main-display').classList.remove('hidden');
        outputSection.classList.remove('hidden');
    });

    // --- EVENT LISTENERS ---

    // Listener for stat cards to show modal and highlighting
    resultsContainer.addEventListener('click', (e) => {
        const clickedCard = e.target.closest('.stat-card');
        if (!clickedCard) return;

        const filterType = clickedCard.dataset.type;
        showCalculationModal(filterType);

        if (filterType === 'hit' || filterType === 'fault') {
            if (activeFilter === filterType) {
                activeFilter = null;
                clearHighlighting();
            } else {
                activeFilter = filterType;
                applyHighlighting(filterType);
            }
        }
    });

    // Listeners to close the modal
    modalCloseBtn.addEventListener('click', () => modal.classList.remove('visible'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('visible');
        }
    });
    
    // --- ALGORITHM FUNCTIONS ---
    function runFIFO(refString, frameCount) {
        let frames = Array(frameCount).fill(null);
        let queue = [];
        let steps = [];
        let hits = 0;
        let faults = 0;

        refString.forEach(page => {
            let currentStep = { isHit: false, frames: [...frames] };
            if (frames.includes(page)) {
                hits++;
                currentStep.isHit = true;
            } else {
                faults++;
                if (frames.includes(null)) {
                    const emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    queue.push(page);
                } else {
                    const pageToReplace = queue.shift();
                    const replaceIndex = frames.indexOf(pageToReplace);
                    frames[replaceIndex] = page;
                    queue.push(page);
                }
            }
            currentStep.frames = [...frames];
            steps.push(currentStep);
        });
        return { steps, hits, faults };
    }

    function runLRU(refString, frameCount) {
        let frames = Array(frameCount).fill(null);
        let recency = [];
        let steps = [];
        let hits = 0;
        let faults = 0;

        refString.forEach(page => {
            let currentStep = { isHit: false, frames: [...frames] };
            if (frames.includes(page)) {
                hits++;
                currentStep.isHit = true;
                recency = recency.filter(p => p !== page);
                recency.push(page);
            } else {
                faults++;
                if (frames.includes(null)) {
                    const emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    recency.push(page);
                } else {
                    const pageToReplace = recency.shift();
                    const replaceIndex = frames.indexOf(pageToReplace);
                    frames[replaceIndex] = page;
                    recency.push(page);
                }
            }
            currentStep.frames = [...frames];
            steps.push(currentStep);
        });
        return { steps, hits, faults };
    }

    function runFifoShiftingAlgorithm(refString, frameCount, mainAlgorithmSteps) {
        let frames = Array(frameCount).fill(null);
        let steps = [];

        refString.forEach((page, index) => {
            if (!mainAlgorithmSteps[index].isHit) {
                let tempFrames = [...frames];
                tempFrames.unshift(page);
                tempFrames.pop();
                frames = tempFrames;
            }
            steps.push({ frames: [...frames] });
        });
        return { steps };
    }

    function runLruShiftingAlgorithm(refString, frameCount, mainAlgorithmSteps) {
        let frames = Array(frameCount).fill(null);
        let steps = [];

        refString.forEach((page, index) => {
            let tempFrames = frames.filter(f => f !== null);
            const isHit = mainAlgorithmSteps[index].isHit;
            
            if (isHit) {
                tempFrames = tempFrames.filter(p => p !== page);
            }
            tempFrames.unshift(page);
            if (tempFrames.length > frameCount) {
                tempFrames.pop();
            }
            while(tempFrames.length < frameCount) {
                tempFrames.push(null);
            }
            frames = tempFrames;
            steps.push({ frames: [...frames] });
        });
        return { steps };
    }

    // --- RENDERING FUNCTIONS ---
    function renderSolutionTable(tableId, steps, refString, frameCount, includeStatus, includePageRow) {
        const table = document.getElementById(tableId);
        let header = '';

        if (includePageRow) {
            header = '<thead><tr><th>Page</th>';
            refString.forEach(p => header += `<th>${p}</th>`);
            header += '</tr></thead>';
        }
        
        let body = '<tbody>';
        for (let i = 0; i < frameCount; i++) {
            body += `<tr><td class="font-semibold">Frame ${i + 1}</td>`;
            steps.forEach(step => {
                const pageInFrame = step.frames[i];
                body += `<td>${pageInFrame !== null ? pageInFrame : ''}</td>`;
            });
            body += '</tr>';
        }

        if (includeStatus) {
            body += `<tr><td class="font-semibold">Status</td>`;
            steps.forEach(step => {
                const statusClass = step.isHit ? 'hit' : 'fault';
                const statusText = step.isHit ? 'Hit' : 'Fault';
                body += `<td class="${statusClass}">${statusText}</td>`;
            });
            body += '</tr>';
        }
        body += '</tbody>';
        table.innerHTML = header + body;
    }

    function renderStatistics(hits, faults, total) {
        const container = document.getElementById('results-content');
        const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : 0;
        const faultRate = total > 0 ? ((faults / total) * 100).toFixed(2) : 0;
        const hitFaultRatio = faults > 0 ? (hits/faults).toFixed(2) : (total > 0 ? hits.toFixed(2) : "N/A");

        const cards = [
            { title: 'Page Hits', value: hits, rate: `${hitRate}%`, type: 'hit', ...getCardStyles('green') },
            { title: 'Page Faults', value: faults, rate: `${faultRate}%`, type: 'fault', ...getCardStyles('red') },
            { title: 'Total References', value: total, rate: ``, type: 'total', ...getCardStyles('sky') },
            { title: 'Hit/Fault Ratio', value: hitFaultRatio, rate: ``, type: 'ratio', ...getCardStyles('slate') }
        ];

        container.innerHTML = cards.map(card => `
            <div class="stat-card border p-6 flex flex-col justify-between ${card.bgColor} ${card.borderColor}" data-type="${card.type || ''}">
                <div class="flex justify-between items-start">
                    <span class="font-semibold ${card.textColor}">${card.title}</span>
                    ${card.icon}
                </div>
                <div class="mt-4 text-left">
                    <span class="text-4xl font-bold ${card.textColor}">${card.value}</span>
                    <span class="ml-2 text-lg font-medium ${card.rateColor}">${card.rate}</span>
                </div>
            </div>
        `).join('');
    }
    
    function getCardStyles(color) {
        const styleMap = {
            green: { icon: `<svg class="w-8 h-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`, bgColor: 'bg-green-50', textColor: 'text-green-800', rateColor: 'text-green-600', borderColor: 'border-green-200/80' },
            red:   { icon: `<svg class="w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`, bgColor: 'bg-red-50', textColor: 'text-red-800', rateColor: 'text-red-600', borderColor: 'border-red-200/80' },
            sky:   { icon: `<svg class="w-8 h-8 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 12h9.75M10.5 18h9.75M3.75 6H7.5v1.5H3.75V6Zm0 6H7.5v1.5H3.75V12Zm0 6H7.5v1.5H3.75V18Z" /></svg>`, bgColor: 'bg-sky-50', textColor: 'text-sky-800', rateColor: 'text-sky-600', borderColor: 'border-sky-200/80' },
            slate: { icon: `<svg class="w-8 h-8 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>`, bgColor: 'bg-slate-50', textColor: 'text-slate-800', rateColor: 'text-slate-600', borderColor: 'border-slate-200/80' }
        };
        return styleMap[color];
    }

    // --- UI HELPER FUNCTIONS ---
    function clearHighlighting() {
        document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('#main-solution-table th, #main-solution-table td').forEach(cell => {
            cell.classList.remove('highlight', 'dim');
        });
    }

    function applyHighlighting(filterType) {
        clearHighlighting();
        const targetCard = document.querySelector(`.stat-card[data-type="${filterType}"]`);
        if (targetCard) targetCard.classList.add('active');

        const table = document.getElementById('main-solution-table');
        const statusRow = table.querySelector('tbody tr:last-child');
        if (!statusRow || !statusRow.querySelector('.hit, .fault')) return;

        const indicesToHighlight = [];
        const statusCells = statusRow.querySelectorAll('td');
        statusCells.forEach((cell, index) => {
            if (index === 0) return; // Skip "Status" header cell
            if ((filterType === 'hit' && cell.classList.contains('hit')) || (filterType === 'fault' && cell.classList.contains('fault'))) {
                indicesToHighlight.push(index);
            }
        });

        table.querySelectorAll('tr').forEach(row => {
            row.querySelectorAll('th, td').forEach((cell, index) => {
                if (indicesToHighlight.includes(index)) {
                    cell.classList.add('highlight');
                } else {
                    cell.classList.add('dim');
                }
            });
        });
    }

    function showCalculationModal(type) {
        if (!lastResults.total) return; // Don't show if no calculation has been run

        const { hits, faults, total } = lastResults;
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        let content = '';
        
        switch(type) {
            case 'hit':
                const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;
                modalTitle.textContent = 'Hit Rate Calculation';
                content = `(<span class="value">${hits}</span> Hits / <span class="value">${total}</span> Total) * 100% = <span class="result">${hitRate}%</span>`;
                break;
            case 'fault':
                const faultRate = total > 0 ? (faults / total * 100).toFixed(2) : 0;
                modalTitle.textContent = 'Fault Rate Calculation';
                content = `(<span class="value">${faults}</span> Faults / <span class="value">${total}</span> Total) * 100% = <span class="result">${faultRate}%</span>`;
                break;
            case 'total':
                modalTitle.textContent = 'Total References';
                content = `The total number of pages in the reference string is <span class="result">${total}</span>.`;
                break;
            case 'ratio':
                const ratio = faults > 0 ? (hits / faults).toFixed(2) : (total > 0 ? hits.toFixed(2) : "N/A");
                modalTitle.textContent = 'Hit/Fault Ratio Calculation';
                content = `<span class="value">${hits}</span> Hits / <span class="value">${faults}</span> Faults = <span class="result">${ratio}</span>`;
                break;
            default:
                return; // Do nothing for cards without a type
        }
        
        modalBody.innerHTML = content;
        modal.classList.add('visible');
    }
});
