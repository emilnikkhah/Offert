document.addEventListener('DOMContentLoaded', () => {
    let allArticles = [];

    // Funktion för att förhandsgranska offert (HTML i ny flik)
    function previewQuote(quoteId) {
        if (!quoteId) {
            console.error("Inget offert-ID angivet för förhandsgranskning.");
            alert("Kunde inte förhandsgranska: Inget offert-ID.");
            return;
        }
        window.open(`/api/offerter/${quoteId}/preview`, '_blank');
    }

    function formatSwedishPrice(number, includeCurrency = false, currencySuffix = 'kr') {
        if (number === null || typeof number === 'undefined') return '-';
        const num = parseFloat(number);
        if (isNaN(num)) return '-';
        
        const options = {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true // Aktivera tusentalsavgränsare
        };

        let formattedNum = new Intl.NumberFormat('sv-SE', options).format(num);

        if (includeCurrency) {
            return `${formattedNum} ${currencySuffix}`;
        }
        return formattedNum;
    }

    async function fetchCustomersForDropdown() {
        try {
            const response = await fetch('/api/kunder');
            if (!response.ok) {
                if (response.status === 401) { // NY KONTROLL
                    console.warn('Ej autentiserad för /api/kunder (dropdown). Omdirigerar till login.');
                    window.location.href = '/login.html';
                    return; 
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const quoteCustomerSelect = document.getElementById('quote_customer_id');
            if (!quoteCustomerSelect) return;
            const currentQuoteCustomerVal = quoteCustomerSelect.value;
            while (quoteCustomerSelect.options.length > 1) quoteCustomerSelect.remove(1);
            if (result.data && result.data.length > 0) {
                result.data.forEach(customer => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = `${customer.company_name || customer.contact_person} (ID: ${customer.id})`;
                    quoteCustomerSelect.appendChild(option);
                });
                if (quoteCustomerSelect.querySelector(`option[value="${currentQuoteCustomerVal}"`)) {
                    quoteCustomerSelect.value = currentQuoteCustomerVal;
                }
            }
        } catch (error) {
            if (!(error.message.includes("401"))) {
               console.error('Fel vid hämtning av kunder för dropdown:', error);
            }
        }
    }

    async function fetchArticlesForSelection() {
        try {
            const response = await fetch('/api/artiklar');
            if (!response.ok) {
                if (response.status === 401) { // NY KONTROLL
                    console.warn('Ej autentiserad för /api/artiklar (selection). Omdirigerar till login.');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.data) {
                allArticles = result.data;
            }
        } catch (error) {
            console.error('Fel vid hämtning av artiklar:', error);
            allArticles = [];
        }
    }

    const addQuoteForm = document.getElementById('addQuoteForm');
    const quoteList = document.getElementById('quoteList');
    const showAddQuoteFormBtn = document.getElementById('showAddQuoteFormBtn');
    const quoteFormTitle = document.getElementById('quoteFormTitle');
    const formListSeparator = document.getElementById('formListSeparator');
    const filterCustomerNameInput = document.getElementById('filterCustomerName');
    const filterProductionNameInput = document.getElementById('filterProductionName');
    const filterStatusInput = document.getElementById('filterStatus');

    if (!addQuoteForm || !quoteList || !showAddQuoteFormBtn) {
        if (document.getElementById('quote_customer_id')) fetchCustomersForDropdown();
        fetchArticlesForSelection();
        if (filterCustomerNameInput || filterProductionNameInput || filterStatusInput) fetchAndDisplayQuotes();
        return;
    }

    const quoteSubmitButton = addQuoteForm.querySelector('button[type="submit"]');
    const quoteCustomerSelect = document.getElementById('quote_customer_id');
    const productionNameInput = document.getElementById('production_name');
    const quoteNumberInput = document.getElementById('quote_number');
    const suggestQuoteNumberBtn = document.getElementById('suggestQuoteNumberBtn');
    const quoteDateInput = document.getElementById('quote_date');
    const quoteStatusSelectInForm = document.getElementById('quote_status');
    const quoteItemsContainer = document.getElementById('quoteItemsContainer');
    const addQuoteItemBtn = document.getElementById('addQuoteItemBtn');
    const totalAmountExclVatInput = document.getElementById('total_amount_excl_vat');
    const vatPercentageInput = document.getElementById('vat_percentage');
    const totalAmountInclVatInput = document.getElementById('total_amount_incl_vat');
    let currentEditingQuoteId = null;
    let quoteCancelButton = null;
    const quoteStatuses = ['Utkast', 'Skickad', 'Accepterad', 'Avvisad', 'Arkiverad'];
    let filterDebounceTimer;

    function showQuoteForm(show = true) {
        addQuoteForm.style.display = show ? 'block' : 'none';
        formListSeparator.style.display = show ? 'block' : 'none';
        showAddQuoteFormBtn.style.display = show ? 'none' : 'block';
    }

    function createQuoteItemHTML(itemData = null) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('quote-item');
        
        let articleOptionsHTML = '<option value="">-- Välj artikel --</option>';
        allArticles.forEach(article => {
            const price = article.default_price_excl_vat !== null ? formatSwedishPrice(article.default_price_excl_vat) : '' ;
            articleOptionsHTML += `<option value="${article.id}" ${itemData?.article_id == article.id ? 'selected' : ''}>${article.name} (${price})</option>`;
        });
    
        itemDiv.innerHTML = `
            <div class="quote-item-cell item-article-select-cell">
                <select name="item_article_select" class="item-article-select">${articleOptionsHTML}</select>
                <input type="hidden" name="item_article_id" value="${itemData?.article_id || ''}">
            </div>
            <div class="quote-item-cell item-description-cell">
                <input type="text" name="item_description" placeholder="Beskrivning" value="${itemData?.description || ''}" required>
            </div>
            <div class="quote-item-cell item-quantity-cell">
                <input type="number" name="item_quantity" value="${itemData?.quantity || 1}" step="any" required>
            </div>
            <div class="quote-item-cell item-unit-cell">
                <input type="text" name="item_unit" placeholder="Enhet" value="${itemData?.unit || ''}">
            </div>
            <div class="quote-item-cell item-price-cell">
                <input type="number" name="item_unit_price" placeholder="Á-pris" value="${itemData?.unit_price_excl_vat || ''}" step="any" required>
            </div>
            <div class="quote-item-cell item-discount-cell">
                <input type="number" name="item_discount" placeholder="Rabatt %" value="${itemData?.discount_percentage || 0}" step="any">
            </div>
            <div class="quote-item-cell item-linetotal-cell">
                <span class="item-line-total">${formatSwedishPrice(0)}</span>
            </div>
            <div class="quote-item-cell item-action-cell">
                <button type="button" class="removeQuoteItemBtn" title="Ta bort rad">X</button>
            </div>
        `;

        const articleSelect = itemDiv.querySelector('.item-article-select');
        articleSelect.addEventListener('change', (event) => {
            const selectedArticleId = event.target.value;
            itemDiv.querySelector('input[name="item_article_id"]').value = selectedArticleId;
            const article = allArticles.find(a => a.id == selectedArticleId);
            if (article) {
                itemDiv.querySelector('input[name="item_description"]').value = article.name;
                itemDiv.querySelector('input[name="item_unit"]').value = article.unit || '';
                itemDiv.querySelector('input[name="item_unit_price"]').value = article.default_price_excl_vat !== null ? article.default_price_excl_vat : '';
            } else {
                 itemDiv.querySelector('input[name="item_description"]').value = '';
                 itemDiv.querySelector('input[name="item_unit"]').value = '';
                 itemDiv.querySelector('input[name="item_unit_price"]').value = '';
            }
            updateQuoteTotals();
        });

        itemDiv.querySelector('.removeQuoteItemBtn').addEventListener('click', () => {
            itemDiv.remove();
            updateQuoteTotals();
        });

        ['item_description','item_quantity', 'item_unit', 'item_unit_price', 'item_discount'].forEach(name => {
            const inputField = itemDiv.querySelector(`input[name="${name}"]`);
            if (inputField) inputField.addEventListener('input', updateQuoteTotals);
        });
    
        return itemDiv;
    }

    function addQuoteItemRow(itemData = null) {
        const newItemRow = createQuoteItemHTML(itemData);
        quoteItemsContainer.appendChild(newItemRow);
        if (itemData && itemData.article_id) {
            const select = newItemRow.querySelector('.item-article-select');
            if (select) {
                select.value = itemData.article_id;
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
            }
        }
        updateQuoteTotals();
    }

    function updateQuoteTotals() {
        if (!quoteItemsContainer) return;
        let currentSubtotal = 0;
        const quoteItems = quoteItemsContainer.querySelectorAll('.quote-item');
        quoteItems.forEach(item => {
            const quantity = parseFloat(item.querySelector('input[name="item_quantity"]').value) || 0;
            const unitPrice = parseFloat(item.querySelector('input[name="item_unit_price"]').value) || 0;
            const discountPercent = parseFloat(item.querySelector('input[name="item_discount"]').value) || 0;
            const lineTotalBeforeDiscount = quantity * unitPrice;
            const discountAmount = lineTotalBeforeDiscount * (discountPercent / 100);
            const lineTotalAfterDiscount = lineTotalBeforeDiscount - discountAmount;
            item.querySelector('.item-line-total').textContent = formatSwedishPrice(lineTotalAfterDiscount);
            currentSubtotal += lineTotalAfterDiscount;
        });
        if (totalAmountExclVatInput) totalAmountExclVatInput.value = currentSubtotal.toFixed(2);
        const vatPercentage = parseFloat(vatPercentageInput.value) || 0;
        const vatAmount = currentSubtotal * (vatPercentage / 100);
        if (totalAmountInclVatInput) totalAmountInclVatInput.value = (currentSubtotal + vatAmount).toFixed(2);
    }

    if (addQuoteItemBtn) addQuoteItemBtn.addEventListener('click', () => addQuoteItemRow());
    if (vatPercentageInput) vatPercentageInput.addEventListener('input', updateQuoteTotals);

    async function setupFormForEditOrDuplicate(quote, isDuplicate = false) {
        resetQuoteFormToCreateMode(false, false);
        quoteFormTitle.textContent = isDuplicate ? `Skapa offert (Kopia av ${quote.quote_number})` : 'Redigera offert';
        addQuoteForm.elements['quote_number'].value = isDuplicate ? '' : (quote.quote_number || '');
        addQuoteForm.elements['customer_id'].value = quote.customer_id || '';
        addQuoteForm.elements['production_name'].value = isDuplicate ? (quote.production_name || '') : (quote.production_name || '');
        addQuoteForm.elements['quote_date'].valueAsDate = new Date();
        addQuoteForm.elements['valid_until_date'].valueAsDate = isDuplicate ? null : (quote.valid_until_date ? new Date(quote.valid_until_date) : null);
        if (quoteStatusSelectInForm) quoteStatusSelectInForm.value = isDuplicate ? 'Utkast' : (quote.status || 'Utkast');
        addQuoteForm.elements['payment_terms'].value = quote.payment_terms || '30 dagar netto';
        addQuoteForm.elements['delivery_terms'].value = quote.delivery_terms || 'Enligt överenskommelse';
        addQuoteForm.elements['internal_notes'].value = isDuplicate ? `Kopia av offert ${quote.quote_number}. Original anteckningar: ${quote.internal_notes || ''}` : (quote.internal_notes || '');
        addQuoteForm.elements['vat_percentage'].value = quote.vat_percentage !== null ? quote.vat_percentage : 25;
        quoteItemsContainer.innerHTML = '';
        if (quote.items && quote.items.length > 0) {
            quote.items.forEach(item => {
                const itemDataForForm = { ...item };
                if (isDuplicate) {
                    delete itemDataForForm.id;
                    delete itemDataForForm.quote_id;
                }
                addQuoteItemRow(itemDataForForm);
            });
        } else {
            addQuoteItemRow();
        }
        if (isDuplicate) {
            currentEditingQuoteId = null;
            quoteSubmitButton.textContent = 'Spara ny offert';
            await triggerSuggestQuoteNumber();
        } else {
            currentEditingQuoteId = quote.id;
            quoteSubmitButton.textContent = 'Uppdatera offert';
        }
        if (quoteCancelButton) quoteCancelButton.style.display = 'inline-block';
        showQuoteForm(true);
        addQuoteForm.scrollIntoView({ behavior: 'smooth' });
    }

    async function triggerSuggestQuoteNumber() {
        if (suggestQuoteNumberBtn) {
            try {
                const response = await fetch('/api/offerter/next-number');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                quoteNumberInput.value = result.next_quote_number;
            } catch (error) {
                console.error('Fel vid hämtning av nästa offertnummer:', error);
            }
        }
    }

    function resetQuoteFormToCreateMode(hideForm = true, fetchNewNumber = true) {
        addQuoteForm.reset();
        quoteFormTitle.textContent = 'Skapa ny offert';
        if (productionNameInput) productionNameInput.value = '';
        if (quoteDateInput) quoteDateInput.valueAsDate = new Date();
        if (quoteStatusSelectInForm) quoteStatusSelectInForm.value = 'Utkast';
        quoteItemsContainer.innerHTML = '';
        addQuoteItemRow();
        if (fetchNewNumber) {
            triggerSuggestQuoteNumber();
        }
        quoteSubmitButton.textContent = 'Spara offert';
        currentEditingQuoteId = null;
        if (quoteCancelButton) quoteCancelButton.style.display = 'none';
        if (hideForm) {
            showQuoteForm(false);
        }
    }

    showAddQuoteFormBtn.addEventListener('click', () => {
        resetQuoteFormToCreateMode(false, true);
        showQuoteForm(true);
        addQuoteForm.scrollIntoView({ behavior: 'smooth' });
    });

    if (suggestQuoteNumberBtn) {
        suggestQuoteNumberBtn.addEventListener('click', triggerSuggestQuoteNumber);
    }

    async function updateQuoteStatus(quoteId, newStatus, statusSelectElement) {
        const listItem = statusSelectElement.closest('.quote-list-item');
        const statusTag = listItem.querySelector('.quote-cell-status .status-tag');
        const oldStatus = statusSelectElement.dataset.currentStatus || (statusTag ? statusTag.textContent : 'Utkast');
        statusSelectElement.dataset.currentStatus = newStatus;

        try {
            const response = await fetch(`/api/offerter/${quoteId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
            if (statusTag) {
                statusTag.textContent = newStatus;
                statusTag.className = 'status-tag'; 
                statusTag.classList.add(`status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`);
            }
            console.log(result.message);
        } catch (error) {
            console.error('Fel vid uppdatering av offertstatus:', error);
            alert(`Kunde inte uppdatera status: ${error.message}`);
            statusSelectElement.value = oldStatus; 
            statusSelectElement.dataset.currentStatus = oldStatus; 
            if (statusTag) { 
                statusTag.textContent = oldStatus;
                statusTag.className = 'status-tag';
                statusTag.classList.add(`status-${oldStatus.toLowerCase().replace(/\s+/g, '-')}`);
            }
        }
    }

    async function fetchAndDisplayQuotes() {
        const customerNameFilter = filterCustomerNameInput ? filterCustomerNameInput.value.trim() : '';
        const productionNameFilter = filterProductionNameInput ? filterProductionNameInput.value.trim() : '';
        const statusFilter = filterStatusInput ? filterStatusInput.value : '';

        let apiUrl = '/api/offerter';
        const queryParams = [];
        if (customerNameFilter) {
            queryParams.push(`customerName=${encodeURIComponent(customerNameFilter)}`);
        }
        if (productionNameFilter) {
            queryParams.push(`productionName=${encodeURIComponent(productionNameFilter)}`);
        }
        if (statusFilter) {
            queryParams.push(`status=${encodeURIComponent(statusFilter)}`);
        }

        if (queryParams.length > 0) {
            apiUrl += `?${queryParams.join('&')}`;
        }
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 401) { // NY KONTROLL
                    console.warn('Ej autentiserad för offerter API. Omdirigerar till login.');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            quoteList.innerHTML = '';
            if (result.data && result.data.length > 0) {
                result.data.forEach(quote => {
                    const listItem = document.createElement('li');
                    listItem.classList.add('quote-list-item');

                    const kundInfo = quote.customer_company_name || quote.customer_contact_person || 'Okänd kund';
                    const displayTotal = formatSwedishPrice(quote.total_amount_excl_vat);
                    const productionInfoText = quote.production_name || '-';
                    const validDate = quote.valid_until_date ? new Date(quote.valid_until_date).toLocaleDateString('sv-SE') : '-';
                    const currentStatus = quote.status || 'Utkast';
                    const statusClassName = `status-${currentStatus.toLowerCase().replace(/\s+/g, '-')}`;

                    let statusOptionsHTML = '';
                    quoteStatuses.forEach(s => {
                        statusOptionsHTML += `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${s}</option>`;
                    });

                    listItem.innerHTML = `
                        <div class="quote-cell quote-cell-number">${quote.quote_number}</div>
                        <div class="quote-cell quote-cell-status">
                            <span class="status-tag ${statusClassName}">${currentStatus}</span>
                        </div>
                        <div class="quote-cell quote-cell-customer">${kundInfo}</div>
                        <div class="quote-cell quote-cell-production">${productionInfoText}</div>
                        <div class="quote-cell quote-cell-date">${new Date(quote.quote_date).toLocaleDateString('sv-SE')}</div>
                        <div class="quote-cell quote-cell-valid">${validDate}</div>
                        <div class="quote-cell quote-cell-amount">${displayTotal}</div>
                        <div class="quote-cell quote-cell-actions">
                            <button class="edit-btn quote-edit-btn" data-id="${quote.id}" title="Redigera offert">R</button>
                            <button class="duplicate-btn quote-duplicate-btn" data-id="${quote.id}" title="Duplicera offert">D</button>
                            <button class="preview-btn quote-preview-btn" data-id="${quote.id}" title="Förhandsgranska offert">P</button>
                            <button class="pdf-btn quote-pdf-btn" data-id="${quote.id}" title="Ladda ner PDF">PDF</button> 
                            <select class="quote-status-select" data-id="${quote.id}" id="status-select-${quote.id}" title="Ändra status" data-current-status="${currentStatus}">
                                ${statusOptionsHTML}
                            </select>
                        </div>
                    `;
                    quoteList.appendChild(listItem);

                    listItem.querySelector('.quote-edit-btn').addEventListener('click', async () => {
                        try {
                            const singleQuoteResponse = await fetch(`/api/offerter/${quote.id}`);
                            if (!singleQuoteResponse.ok) throw new Error(`HTTP error! status: ${singleQuoteResponse.status}`);
                            const quoteResult = await singleQuoteResponse.json();
                            setupFormForEditOrDuplicate(quoteResult.data, false);
                        } catch (err) {
                            console.error('Fel vid hämtning av offert för redigering:', err);
                            alert('Kunde inte ladda offerten för redigering.');
                        }
                    });
                    listItem.querySelector('.quote-duplicate-btn').addEventListener('click', async () => {
                        if (confirm(`Vill du skapa en ny offert baserad på ${quote.quote_number}?`)) {
                            try {
                                const singleQuoteResponse = await fetch(`/api/offerter/${quote.id}`);
                                if (!singleQuoteResponse.ok) throw new Error(`HTTP error! status: ${singleQuoteResponse.status}`);
                                const quoteResult = await singleQuoteResponse.json();
                                setupFormForEditOrDuplicate(quoteResult.data, true);
                            } catch (err) {
                                console.error('Fel vid hämtning av offert för duplicering:', err);
                                alert('Kunde inte ladda offerten för duplicering.');
                            }
                        }
                    });
                    const statusSelectElement = listItem.querySelector('.quote-status-select');
                    statusSelectElement.addEventListener('change', (event) => {
                        updateQuoteStatus(quote.id, event.target.value, statusSelectElement);
                    });

                    // Event listener för PDF-knappen
                    const pdfButton = listItem.querySelector('.quote-pdf-btn');
                    if (pdfButton) {
                        pdfButton.addEventListener('click', () => {
                            window.location.href = `/api/offerter/${quote.id}/pdf`;
                        });
                    }

                    // NY Event listener för Förhandsgranska-knappen
                    const previewButton = listItem.querySelector('.quote-preview-btn');
                    if (previewButton) {
                        previewButton.addEventListener('click', () => {
                            previewQuote(quote.id);
                        });
                    }
                });
            } else {
                quoteList.innerHTML = '<li>Inga offerter matchade dina filter.</li>';
            }
        } catch (error) {
            if (!(error.message.includes("401"))) {
                console.error('Fel vid hämtning av offerter:', error);
                quoteList.innerHTML = '<li>Kunde inte ladda offerter.</li>';
            }
        }
    }

    // Event listeners för filter-inputfälten (och select för status)
    if (filterCustomerNameInput) filterCustomerNameInput.addEventListener('input', () => {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(fetchAndDisplayQuotes, 500);
    });
    if (filterProductionNameInput) filterProductionNameInput.addEventListener('input', () => {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(fetchAndDisplayQuotes, 500);
    });
    if (filterStatusInput) filterStatusInput.addEventListener('change', fetchAndDisplayQuotes); 
    
    if (addQuoteForm) {
        addQuoteForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(addQuoteForm);
            const quoteData = { items: [] };
            for (let [key, value] of formData.entries()) {
                if (!key.startsWith('item_') || key === 'item_article_id') {
                    if (key !== 'item_article_select') {
                        quoteData[key] = value;
                    }
                }
            }
            const itemRows = quoteItemsContainer.querySelectorAll('.quote-item');
            itemRows.forEach(row => {
                const item = {
                    article_id: row.querySelector('input[name="item_article_id"]').value || null,
                    description: row.querySelector('input[name="item_description"]').value,
                    quantity: parseFloat(row.querySelector('input[name="item_quantity"]').value) || 0,
                    unit: row.querySelector('input[name="item_unit"]').value,
                    unit_price_excl_vat: parseFloat(row.querySelector('input[name="item_unit_price"]').value) || 0,
                    discount_percentage: parseFloat(row.querySelector('input[name="item_discount"]').value) || 0
                };
                const lineTotalBeforeDiscount = item.quantity * item.unit_price_excl_vat;
                const discountAmount = lineTotalBeforeDiscount * (item.discount_percentage / 100);
                item.line_total_excl_vat = lineTotalBeforeDiscount - discountAmount;
                quoteData.items.push(item);
            });
            quoteData.total_amount_excl_vat = parseFloat(totalAmountExclVatInput.value) || 0;
            quoteData.vat_percentage = parseFloat(vatPercentageInput.value) || 25;
            quoteData.total_amount_incl_vat = parseFloat(totalAmountInclVatInput.value) || 0;
            try {
                let url = currentEditingQuoteId ? `/api/offerter/${currentEditingQuoteId}` : '/api/offerter';
                let method = currentEditingQuoteId ? 'PUT' : 'POST';
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quoteData)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
                alert(result.message || (method === 'PUT' ? 'Offert uppdaterad!' : 'Offert skapad!'));
                resetQuoteFormToCreateMode(true, true);
                fetchAndDisplayQuotes();
            } catch (error) {
                console.error((currentEditingQuoteId ? 'Fel vid uppdatering' : 'Fel vid skapande') + ' av offert:', error);
                alert(`Kunde inte ${currentEditingQuoteId ? 'uppdatera' : 'skapa'} offert: ${error.message}`);
            }
        });
        quoteCancelButton = document.createElement('button');
        quoteCancelButton.type = 'button';
        quoteCancelButton.textContent = 'Avbryt';
        quoteCancelButton.style.marginLeft = '10px';
        quoteCancelButton.style.backgroundColor = '#7f8c8d';
        quoteCancelButton.style.display = 'none';
        quoteCancelButton.addEventListener('click', () => resetQuoteFormToCreateMode(true, true));
        if (quoteSubmitButton) {
            quoteSubmitButton.parentNode.insertBefore(quoteCancelButton, quoteSubmitButton.nextSibling);
        }
    }

    const backupDbBtn = document.getElementById('backupDbBtn');
    if (backupDbBtn) {
        backupDbBtn.addEventListener('click', async () => {
            backupDbBtn.textContent = 'Skapar backup...';
            backupDbBtn.disabled = true;
            try {
                window.location.href = '/api/db-backup';
                setTimeout(() => {
                    backupDbBtn.textContent = 'Ta backup på databas';
                    backupDbBtn.disabled = false;
                }, 5000);
            } catch (error) {
                console.error('Fel vid initiering av databasbackup:', error);
                alert('Kunde inte starta backup av databasen. Se konsolen för mer info.');
                backupDbBtn.textContent = 'Ta backup på databas';
                backupDbBtn.disabled = false;
            }
        });
    }

    fetchArticlesForSelection().then(() => {
        fetchCustomersForDropdown();
        fetchAndDisplayQuotes();
        showQuoteForm(false);
        if (addQuoteForm && quoteItemsContainer.children.length === 0) {
            resetQuoteFormToCreateMode(true, true);
            showQuoteForm(false);
        }
    });
});
