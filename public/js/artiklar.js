document.addEventListener('DOMContentLoaded', () => {
    const addArticleForm = document.getElementById('addArticleForm');
    const articleList = document.getElementById('articleList');
    const showAddArticleFormBtn = document.getElementById('showAddArticleFormBtn');
    const articleFormTitle = document.getElementById('articleFormTitle');
    const articleFormListSeparator = document.getElementById('articleFormListSeparator');
    const cancelArticleEditBtn = document.getElementById('cancelArticleEditBtn');

    if (!addArticleForm || !articleList || !showAddArticleFormBtn || !articleFormTitle || !articleFormListSeparator || !cancelArticleEditBtn) {
        // console.warn('Några artikelhanterings-element hittades inte på denna sida. Funktioner kan vara begränsade.');
        return; 
    }

    const articleSubmitButton = addArticleForm.querySelector('button[type="submit"]');
    let currentEditingArticleId = null;

    // Hjälpfunktion för att formatera priser enligt svensk standard
    function formatSwedishPrice(number) {
        if (number === null || typeof number === 'undefined') return '-';
        const num = parseFloat(number);
        if (isNaN(num)) return '-';
        return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(num);
    }

    function showArticleForm(show = true) {
        addArticleForm.style.display = show ? 'block' : 'none';
        articleFormListSeparator.style.display = show ? 'block' : 'none';
        showAddArticleFormBtn.style.display = show ? 'none' : 'block';
        cancelArticleEditBtn.style.display = show ? 'inline-block' : 'none';
        if (show && currentEditingArticleId === null) { 
             articleFormTitle.textContent = 'Lägg till ny artikel';
             articleSubmitButton.textContent = 'Spara artikel';
        }
    }

    function populateArticleFormForEdit(article) {
        articleFormTitle.textContent = 'Redigera artikel';
        addArticleForm.elements['article_number'].value = article.article_number || '';
        addArticleForm.elements['name'].value = article.name || '';
        addArticleForm.elements['unit'].value = article.unit || '';
        addArticleForm.elements['default_price_excl_vat'].value = article.default_price_excl_vat !== null ? article.default_price_excl_vat : '';
        addArticleForm.elements['notes'].value = article.notes || '';
        
        articleSubmitButton.textContent = 'Uppdatera artikel';
        currentEditingArticleId = article.id;
        showArticleForm(true);
        addArticleForm.scrollIntoView({ behavior: 'smooth' });
    }

    function resetArticleFormToCreateMode(hideForm = true) {
        addArticleForm.reset();
        articleFormTitle.textContent = 'Lägg till ny artikel';
        articleSubmitButton.textContent = 'Spara artikel';
        currentEditingArticleId = null;
        if (hideForm) {
            showArticleForm(false);
        }
    }

    showAddArticleFormBtn.addEventListener('click', () => {
        resetArticleFormToCreateMode(false);
        showArticleForm(true);
        addArticleForm.scrollIntoView({ behavior: 'smooth' });
    });

    cancelArticleEditBtn.addEventListener('click', () => {
        resetArticleFormToCreateMode(true);
    });

    async function fetchAndDisplayArticles() {
        try {
            const response = await fetch('/api/artiklar');
            if (!response.ok) {
                if (response.status === 401) { // NY KONTROLL
                    console.warn('Ej autentiserad för /api/artiklar. Omdirigerar till login.');
                    window.location.href = '/login.html';
                    return; 
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            articleList.innerHTML = ''; // articleList är nu en div

            if (result.data && result.data.length > 0) {
                result.data.forEach(article => {
                    const articleItem = document.createElement('div'); // Ändrat från 'li'
                    articleItem.classList.add('article-list-item'); // Ny klass för styling

                    // Skapa celler för varje kolumn
                    const numberCell = document.createElement('div');
                    numberCell.classList.add('article-cell', 'number');
                    numberCell.textContent = article.article_number || '-';
                    articleItem.appendChild(numberCell);

                    const nameCell = document.createElement('div');
                    nameCell.classList.add('article-cell', 'name');
                    nameCell.textContent = article.name || 'Namn saknas';
                    articleItem.appendChild(nameCell);

                    const unitCell = document.createElement('div');
                    unitCell.classList.add('article-cell', 'unit');
                    unitCell.textContent = article.unit || '-';
                    articleItem.appendChild(unitCell);

                    const priceCell = document.createElement('div');
                    priceCell.classList.add('article-cell', 'price');
                    priceCell.textContent = formatSwedishPrice(article.default_price_excl_vat); // Använd din befintliga funktion
                    articleItem.appendChild(priceCell);
                    
                    const notesCell = document.createElement('div');
                    notesCell.classList.add('article-cell', 'notes');
                    notesCell.textContent = article.notes || '-';
                    // För att förkorta långa anteckningar kan vi lägga till en title-attribut
                    if (article.notes && article.notes.length > 50) { // Exempelgräns
                        notesCell.title = article.notes;
                        notesCell.textContent = article.notes.substring(0, 47) + '...';
                    }
                    articleItem.appendChild(notesCell);

                    const actionsCell = document.createElement('div');
                    actionsCell.classList.add('article-cell', 'actions');
                    
                    const editButton = document.createElement('button');
                    editButton.classList.add('edit-btn', 'article-edit-btn');
                    editButton.dataset.id = article.id;
                    editButton.textContent = 'Redigera';
                    editButton.addEventListener('click', () => populateArticleFormForEdit(article));
                    actionsCell.appendChild(editButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.classList.add('delete-btn', 'article-delete-btn');
                    deleteButton.dataset.id = article.id;
                    deleteButton.textContent = 'Ta bort';
                    deleteButton.addEventListener('click', async () => {
                        if (confirm(`Är du säker på att du vill ta bort artikeln "${article.name}"? Eventuella kopplingar i offertrader kommer att nollställas.`)) {
                            try {
                                const deleteResponse = await fetch(`/api/artiklar/${article.id}`, { method: 'DELETE' });
                                const deleteResult = await deleteResponse.json();
                                if (!deleteResponse.ok) throw new Error(deleteResult.error || `HTTP error! status: ${deleteResponse.status}`);
                                alert(deleteResult.message || 'Artikel raderad!');
                                fetchAndDisplayArticles(); 
                            } catch (error) {
                                console.error('Fel vid radering av artikel:', error);
                                alert(`Kunde inte radera artikel: ${error.message}`);
                            }
                        }
                    });
                    actionsCell.appendChild(deleteButton);
                    articleItem.appendChild(actionsCell);

                    articleList.appendChild(articleItem);
                });
            } else {
                const noArticlesMessage = document.createElement('div');
                noArticlesMessage.classList.add('article-list-empty'); // Klass för eventuell styling
                noArticlesMessage.textContent = 'Inga artiklar att visa.';
                articleList.appendChild(noArticlesMessage);
            }
        } catch (error) {
            if (error.message.includes("Failed to fetch") && !navigator.onLine) {
                 articleList.innerHTML = '<div class="article-list-empty">Nätverksfel. Kontrollera din anslutning.</div>';
            } else if (!error.message.includes("401")) { // Om felet inte redan är ett 401 som borde ha omdirigerat
                console.error('Fel vid hämtning av artiklar:', error);
                articleList.innerHTML = '<div class="article-list-empty">Kunde inte ladda artikellistan.</div>';
            }
        }
    }

    addArticleForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(addArticleForm);
        const articleData = {};
        formData.forEach((value, key) => articleData[key] = value);
        
        if (articleData.default_price_excl_vat === '') {
            articleData.default_price_excl_vat = null;
        } else {
            articleData.default_price_excl_vat = parseFloat(articleData.default_price_excl_vat);
        }

        try {
            let url = currentEditingArticleId ? `/api/artiklar/${currentEditingArticleId}` : '/api/artiklar';
            let method = currentEditingArticleId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(articleData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
            alert(result.message || (method === 'PUT' ? 'Artikel uppdaterad!' : 'Artikel skapad!'));
            resetArticleFormToCreateMode(true);
            fetchAndDisplayArticles();
        } catch (error) {
            console.error((currentEditingArticleId ? 'Fel vid uppdatering' : 'Fel vid tillägg') + ' av artikel:', error);
            alert(`Kunde inte ${currentEditingArticleId ? 'uppdatera' : 'lägga till'} artikel: ${error.message}`);
        }
    });

    fetchAndDisplayArticles();
    showArticleForm(false);
});
