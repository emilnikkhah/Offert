document.addEventListener('DOMContentLoaded', () => {
    const addCustomerForm = document.getElementById('addCustomerForm');
    const customerList = document.getElementById('customerList');
    const showAddCustomerFormBtn = document.getElementById('showAddCustomerFormBtn');
    const customerFormTitle = document.getElementById('customerFormTitle');
    const customerFormListSeparator = document.getElementById('customerFormListSeparator');
    
    if (!addCustomerForm || !customerList || !showAddCustomerFormBtn || !customerFormTitle || !customerFormListSeparator) {
        return;
    }

    const customerSubmitButton = addCustomerForm.querySelector('button[type="submit"]');
    let currentEditingCustomerId = null;
    let customerCancelButton = null; 

    function showCustomerForm(show = true) {
        addCustomerForm.style.display = show ? 'block' : 'none';
        customerFormListSeparator.style.display = show ? 'block' : 'none';
        showAddCustomerFormBtn.style.display = show ? 'none' : 'block';
        if(customerCancelButton) customerCancelButton.style.display = show ? 'inline-block' : 'none';
    }

    function populateCustomerFormForEdit(customer) {
        resetCustomerFormToCreateMode(false); // Rensa först, men dölj inte formuläret
        customerFormTitle.textContent = 'Redigera kund';
        addCustomerForm.elements['company_name'].value = customer.company_name || '';
        addCustomerForm.elements['contact_person'].value = customer.contact_person || '';
        addCustomerForm.elements['org_number'].value = customer.org_number || '';
        addCustomerForm.elements['vat_number'].value = customer.vat_number || '';
        addCustomerForm.elements['email'].value = customer.email || '';
        addCustomerForm.elements['phone'].value = customer.phone || '';
        addCustomerForm.elements['address'].value = customer.address || '';
        addCustomerForm.elements['postal_code'].value = customer.postal_code || '';
        addCustomerForm.elements['city'].value = customer.city || '';
        addCustomerForm.elements['country'].value = customer.country || 'Sverige';
        
        customerSubmitButton.textContent = 'Uppdatera kund';
        currentEditingCustomerId = customer.id;
        showCustomerForm(true);
        addCustomerForm.scrollIntoView({ behavior: 'smooth' });
    }

    function resetCustomerFormToCreateMode(hideForm = true) {
        addCustomerForm.reset();
        customerFormTitle.textContent = 'Lägg till ny kund';
        customerSubmitButton.textContent = 'Spara kund';
        currentEditingCustomerId = null;
        if (hideForm) {
            showCustomerForm(false);
        }
    }

    showAddCustomerFormBtn.addEventListener('click', () => {
        resetCustomerFormToCreateMode(false);
        showCustomerForm(true);
        addCustomerForm.scrollIntoView({ behavior: 'smooth' });
    });

    async function fetchAndDisplayCustomersOnCustomerPage() {
        try {
            const response = await fetch('/api/kunder');
            if (!response.ok) {
                if (response.status === 401) { // NY KONTROLL
                    console.warn('Ej autentiserad för /api/kunder. Omdirigerar till login.');
                    window.location.href = '/login.html';
                    return; 
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            customerList.innerHTML = ''; // customerList är nu en div

            if (result.data && result.data.length > 0) {
                result.data.forEach(customer => {
                    const customerItem = document.createElement('div'); // Ändrat från 'li'
                    customerItem.classList.add('customer-list-item'); // Ny klass för styling

                    // Skapa celler för varje kolumn
                    const nameCell = document.createElement('div');
                    nameCell.classList.add('customer-cell', 'name');
                    nameCell.textContent = customer.company_name || 'Företag saknas';
                    customerItem.appendChild(nameCell);

                    const contactCell = document.createElement('div');
                    contactCell.classList.add('customer-cell', 'contact');
                    contactCell.textContent = customer.contact_person || 'Kontakt saknas';
                    customerItem.appendChild(contactCell);

                    const cityCell = document.createElement('div');
                    cityCell.classList.add('customer-cell', 'city');
                    cityCell.textContent = customer.city || '-';
                    customerItem.appendChild(cityCell);

                    const emailCell = document.createElement('div');
                    emailCell.classList.add('customer-cell', 'email');
                    emailCell.textContent = customer.email || '-';
                    customerItem.appendChild(emailCell);

                    const actionsCell = document.createElement('div');
                    actionsCell.classList.add('customer-cell', 'actions');
                    
                    const editButton = document.createElement('button');
                    editButton.classList.add('edit-btn', 'customer-edit-btn'); // Behåll befintliga klasser för ev. styling
                    editButton.dataset.id = customer.id;
                    editButton.textContent = 'Redigera';
                    editButton.addEventListener('click', () => populateCustomerFormForEdit(customer));
                    actionsCell.appendChild(editButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.classList.add('delete-btn', 'customer-delete-btn'); // Behåll befintliga klasser
                    deleteButton.dataset.id = customer.id;
                    deleteButton.textContent = 'Ta bort';
                    deleteButton.addEventListener('click', async () => {
                        if (confirm(`Är du säker på att du vill ta bort ${customer.company_name || customer.contact_person}? Offerter kopplade till kunden kommer att avknoppas.`)) {
                            try {
                                const deleteResponse = await fetch(`/api/kunder/${customer.id}`, { method: 'DELETE' });
                                const deleteResult = await deleteResponse.json();
                                if (!deleteResponse.ok) throw new Error(deleteResult.error || `HTTP error! status: ${deleteResponse.status}`);
                                alert(deleteResult.message || 'Kund raderad!');
                                fetchAndDisplayCustomersOnCustomerPage(); 
                            } catch (error) {
                                console.error('Fel vid radering av kund:', error);
                                alert(`Kunde inte radera kund: ${error.message}`);
                            }
                        }
                    });
                    actionsCell.appendChild(deleteButton);
                    customerItem.appendChild(actionsCell);

                    customerList.appendChild(customerItem);
                });
            } else {
                // Om inga kunder, visa ett meddelande inuti customerList-diven
                const noCustomersMessage = document.createElement('div');
                noCustomersMessage.classList.add('customer-list-empty'); // Klass för eventuell styling
                noCustomersMessage.textContent = 'Inga kunder att visa.';
                customerList.appendChild(noCustomersMessage);
            }
        } catch (error) {
            // Undvik att omdirigera här om det inte specifikt är ett 401-fel som missats ovan.
            // Detta catch-block är för generella nätverksfel eller andra problem.
            if (error.message.includes("Failed to fetch") && !navigator.onLine) {
                 customerList.innerHTML = '<div class="customer-list-empty">Nätverksfel. Kontrollera din anslutning.</div>';
            } else if (!error.message.includes("401")) { // Om felet inte redan är ett 401 som borde ha omdirigerat
                console.error('Fel vid hämtning av kunder:', error);
                customerList.innerHTML = '<div class="customer-list-empty">Kunde inte ladda kundlistan.</div>';
            }
        }
    }

    addCustomerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(addCustomerForm);
        const customerData = {};
        formData.forEach((value, key) => customerData[key] = value);

        try {
            let url = currentEditingCustomerId ? `/api/kunder/${currentEditingCustomerId}` : '/api/kunder';
            let method = currentEditingCustomerId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
            alert(result.message || (method === 'PUT' ? 'Kund uppdaterad!' : 'Kund tillagd!'));
            resetCustomerFormToCreateMode(true);
            fetchAndDisplayCustomersOnCustomerPage();
        } catch (error) {
            console.error((currentEditingCustomerId ? 'Fel vid uppdatering' : 'Fel vid tillägg') + ' av kund:', error);
            alert(`Kunde inte ${currentEditingCustomerId ? 'uppdatera' : 'lägga till'} kund: ${error.message}`);
        }
    });

    customerCancelButton = document.createElement('button');
    customerCancelButton.type = 'button';
    customerCancelButton.textContent = 'Avbryt';
    customerCancelButton.style.marginLeft = '10px';
    customerCancelButton.style.backgroundColor = '#7f8c8d';
    customerCancelButton.style.display = 'none'; // Dold initialt
    customerCancelButton.addEventListener('click', () => resetCustomerFormToCreateMode(true));
    
    if(customerSubmitButton) {
        customerSubmitButton.parentNode.insertBefore(customerCancelButton, customerSubmitButton.nextSibling);
    }

    fetchAndDisplayCustomersOnCustomerPage();
    showCustomerForm(false); // Se till att formuläret är dolt vid start
});
