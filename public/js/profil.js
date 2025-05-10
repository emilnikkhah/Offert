document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('companyProfileForm');

    if (!profileForm) {
        return; // Avsluta om formuläret inte finns på sidan
    }

    // Funktion för att hämta och fylla i profildata
    async function fetchAndDisplayProfile() {
        try {
            const response = await fetch('/api/foretagsprofil');
            if (!response.ok) {
                if (response.status === 404) { // Ingen profil finns än, helt okej
                    console.log('Ingen företagsprofil hittades, formuläret är tomt.');
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.data) {
                const profile = result.data;
                for (const key in profile) {
                    if (profileForm.elements[key]) {
                        profileForm.elements[key].value = profile[key] || '';
                    }
                }
            }
        } catch (error) {
            console.error('Fel vid hämtning av företagsprofil:', error);
            alert('Kunde inte ladda företagsprofilen.');
        }
    }

    // Hantera formulärinskickning för att spara/uppdatera profil
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(profileForm);
        const profileData = {};
        formData.forEach((value, key) => {
            profileData[key] = value;
        });

        try {
            const response = await fetch('/api/foretagsprofil', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            alert(result.message || 'Företagsprofil sparad!');
        } catch (error) {
            console.error('Fel vid sparande av företagsprofil:', error);
            alert(`Kunde inte spara företagsprofil: ${error.message}`);
        }
    });

    // Hämta och visa profildata när sidan laddas
    fetchAndDisplayProfile();

    // Lägg till backup-knappens funktionalitet om den finns på denna sida
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
});
