const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const dbDirectory = path.join(__dirname, 'db');
const dbPath = path.join(dbDirectory, 'offert_db.sqlite');

if (!fs.existsSync(dbDirectory)){
    fs.mkdirSync(dbDirectory, { recursive: true });
}

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Kunde inte ansluta till databasen: ' + err.message);
  } else {
    console.log('Ansluten till SQLite-databasen.');
    createTables();
  }
});

Handlebars.registerHelper('formatPrice', function(price, showCurrencySymbol = false, currencySuffix = 'kr') {
    if (price === null || typeof price === 'undefined') return '-';
    const num = parseFloat(price);
    if (isNaN(num)) return '-';
    let formattedNum = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    return showCurrencySymbol ? `${formattedNum} ${currencySuffix}` : formattedNum;
});
Handlebars.registerHelper('formatDate', function(dateString) {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return dateString; }
});
Handlebars.registerHelper('nl2br', function(text) {
    if (text && typeof text === 'string') {
        return new Handlebars.SafeString(text.replace(/\r\n|\n|\r/g, '<br>'));
    }
    return '';
});

function createTables() {
  const createForetagsprofilTable = `
    CREATE TABLE IF NOT EXISTS Foretagsprofil (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
        company_name TEXT, address_line1 TEXT, postal_code TEXT, city TEXT, country TEXT,
        org_number TEXT, vat_number TEXT, phone TEXT, email TEXT, website TEXT,
        bankgiro TEXT, iban TEXT, bic_swift TEXT, logo_path TEXT, 
        f_skatt_text TEXT, signature_text TEXT, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const createForetagsprofilUpdateTrigger = `
    CREATE TRIGGER IF NOT EXISTS update_foretagsprofil_updated_at
    AFTER UPDATE ON Foretagsprofil FOR EACH ROW
    BEGIN UPDATE Foretagsprofil SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
  `;
  const createKunderTable = `
    CREATE TABLE IF NOT EXISTS Kunder (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT, contact_person TEXT, org_number TEXT,
      vat_number TEXT, address TEXT, postal_code TEXT, city TEXT, country TEXT DEFAULT 'Sverige',
      phone TEXT, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const createOfferterTable = `
    CREATE TABLE IF NOT EXISTS Offerter (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quote_number TEXT UNIQUE NOT NULL, customer_id INTEGER,
      production_name TEXT, quote_date DATE NOT NULL, valid_until_date DATE,
      status TEXT DEFAULT 'Utkast' CHECK(status IN ('Utkast', 'Skickad', 'Accepterad', 'Avvisad', 'Arkiverad')),
      total_amount_excl_vat REAL, vat_percentage REAL DEFAULT 25.0, total_amount_incl_vat REAL,
      payment_terms TEXT, delivery_terms TEXT, internal_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pdf_path TEXT, FOREIGN KEY (customer_id) REFERENCES Kunder(id) ON DELETE SET NULL
    );
  `;
  const createOfferterUpdateTrigger = `
    CREATE TRIGGER IF NOT EXISTS update_offerter_updated_at
    AFTER UPDATE ON Offerter FOR EACH ROW
    BEGIN UPDATE Offerter SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
  `;
  const createArtiklarTable = `
    CREATE TABLE IF NOT EXISTS Artiklar (
        id INTEGER PRIMARY KEY AUTOINCREMENT, article_number TEXT UNIQUE, name TEXT NOT NULL,
        unit TEXT, default_price_excl_vat REAL, notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const createArtiklarUpdateTrigger = `
    CREATE TRIGGER IF NOT EXISTS update_artiklar_updated_at
    AFTER UPDATE ON Artiklar FOR EACH ROW
    BEGIN UPDATE Artiklar SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id; END;
  `;
  const createOffertraderTable = `
    CREATE TABLE IF NOT EXISTS Offertrader (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL, article_id INTEGER,
      description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit TEXT,
      unit_price_excl_vat REAL NOT NULL, discount_percentage REAL DEFAULT 0,
      line_total_excl_vat REAL,
      FOREIGN KEY (quote_id) REFERENCES Offerter(id) ON DELETE CASCADE,
      FOREIGN KEY (article_id) REFERENCES Artiklar(id) ON DELETE SET NULL
    );
  `;
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.serialize(() => {
    db.run(createForetagsprofilTable, err => { if (err) console.error("Fel Foretagsprofil:", err.message); else console.log("Tabell 'Foretagsprofil' redo."); });
    db.run(createForetagsprofilUpdateTrigger, err => { if (err) console.error("Fel Foretagsprofil Trigger:", err.message); });
    db.run(createKunderTable, err => { if (err) console.error("Fel Kunder:", err.message); else console.log("Tabell 'Kunder' redo."); });
    db.run(createOfferterTable, err => { if (err) console.error("Fel Offerter:", err.message); else console.log("Tabell 'Offerter' redo."); });
    db.run(createOfferterUpdateTrigger, err => { if (err) console.error("Fel Offerter Trigger:", err.message); });
    db.run(createArtiklarTable, err => { if (err) console.error("Fel Artiklar:", err.message); else console.log("Tabell 'Artiklar' redo."); });
    db.run(createArtiklarUpdateTrigger, err => { if (err) console.error("Fel Artiklar Trigger:", err.message); });
    db.run(createOffertraderTable, err => { if (err) console.error("Fel Offertrader:", err.message); else console.log("Tabell 'Offertrader' redo."); });
    db.run(createUsersTable, err => { if (err) console.error("Fel Users:", err.message); else console.log("Tabell 'Users' redo."); });
  });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET || 'byt_mig_omgaende_till_en_stark_hemlighet';
if (sessionSecret === 'byt_mig_omgaende_till_en_stark_hemlighet' && process.env.NODE_ENV === 'production') {
    console.warn('VARNING: Ingen säker SESSION_SECRET är satt för produktion!');
}
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, 
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

function isAuthenticated(req, res, next) {
    console.log('---isAuthenticated---');
    console.log('KONTROLLERAR SESSION I ISAUTHENTICATED:', JSON.stringify(req.session, null, 2));
    console.log('Session ID:', req.sessionID);
    console.log('req.session.userId:', req.session.userId);
    console.log('req.originalUrl:', req.originalUrl); // NYTT: Logga den faktiska URL:en

    if (req.session.userId) {
        console.log('Användare autentiserad, fortsätter...');
        return next();
    }

    console.log('Användare INTE autentiserad.');
    // Kontrollera om klienten troligtvis förväntar sig HTML (en webbläsare som navigerar)
    // eller JSON (ett API-anrop).
    if (req.originalUrl.startsWith('/api/')) {
        console.log('API-anrop, skickar 401.');
        return res.status(401).json({ error: 'Ej autentiserad. Vänligen logga in.' });
    } else {
        // För alla andra icke-autentiserade anrop (t.ex. sidladdningar), omdirigera till login.
        console.log(`Icke-API anrop (${req.originalUrl}), omdirigerar till /login`);
        return res.redirect('/login');
    }
}

app.get('/login', (req, res) => {
    console.log('---GET /login---');
    if (req.session.userId) {
        console.log('Redan inloggad, omdirigerar till /');
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    console.log('---POST /login---');
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Användarnamn och lösenord krävs.' });
    }
    db.get("SELECT * FROM Users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            console.error("Databasfel vid inloggning:", err.message);
            return res.status(500).json({ error: 'Internt serverfel.' });
        }
        if (!user) {
            console.log(`Användare ${username} hittades inte.`);
            return res.status(401).json({ error: 'Felaktigt användarnamn eller lösenord.' });
        }
        try {
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                req.session.userId = user.id;
                req.session.username = user.username;
                console.log('SESSION VID INLOGGNING:', JSON.stringify(req.session, null, 2));
                console.log(`Användare ${user.username} (ID: ${user.id}) loggade in.`);
                res.json({ message: 'Inloggning lyckades!', redirectUrl: '/' });
            } else {
                console.log(`Felaktigt lösenord för användare: ${username}`);
                res.status(401).json({ error: 'Felaktigt användarnamn eller lösenord.' });
            }
        } catch (compareError) {
            console.error("Fel vid jämförelse av lösenord:", compareError);
            return res.status(500).json({ error: 'Internt serverfel vid lösenordsjämförelse.' });
        }
    });
});

app.post('/logout', isAuthenticated, (req, res) => {
    console.log('---POST /logout---');
    const username = req.session.username;
    req.session.destroy(err => {
        if (err) {
            console.error("Fel vid utloggning:", err);
            return res.status(500).json({ error: 'Kunde inte logga ut.' });
        }
        res.clearCookie('connect.sid');
        console.log(`Användare ${username} loggade ut.`);
        res.json({ message: 'Utloggning lyckades.', redirectUrl: '/login' });
    });
});

app.get('/', isAuthenticated, (req, res) => {
  console.log('---GET /---');
  console.log('SESSION PÅ STARTSIDA (efter isAuthenticated):', JSON.stringify(req.session, null, 2));
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/kunder', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kunder.html'));
});
app.get('/artiklar', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'artiklar.html'));
});
app.get('/profil', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profil.html'));
});

app.get('/api/db-backup', isAuthenticated, (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  const backupFileName = `offert_db_backup_${timestamp}.sqlite`;
  const backupFilePath = path.join(dbDirectory, backupFileName);
  
  const backupDb = new sqlite3.Database(backupFilePath);
  db.backup(backupDb)
    .then(() => {
      backupDb.close();
      console.log(`Databas-backup skapad: ${backupFileName} av användare ${req.session.username}`);
      res.download(backupFilePath, backupFileName, (downloadErr) => {
        if (downloadErr) {
          console.error('Fel vid nedladdning av backupfil:', downloadErr);
        }
      });
    })
    .catch((err) => {
      backupDb.close();
      console.error('Fel vid SQLite backup-process:', err);
      res.status(500).send('Kunde inte skapa backup av databasen.');
    });
});

app.get('/api/foretagsprofil', isAuthenticated, (req, res) => {
    const sql = "SELECT * FROM Foretagsprofil WHERE id = 1";
    db.get(sql, [], (err, row) => {
        if (err) {
            console.error("Fel vid hämtning av företagsprofil: ", err.message);
            return res.status(500).json({ error: "Databasfel vid hämtning av profil." });
        }
        res.json({ message: "Företagsprofil hämtad", data: row || {} });
    });
});
app.put('/api/foretagsprofil', isAuthenticated, (req, res) => {
    const {
        company_name, address_line1, postal_code, city, country,
        org_number, vat_number, phone, email, website,
        bankgiro, iban, bic_swift, logo_path, f_skatt_text, signature_text
    } = req.body;
    const upsertSql = `
        INSERT INTO Foretagsprofil (id, company_name, address_line1, postal_code, city, country, org_number, vat_number, phone, email, website, bankgiro, iban, bic_swift, logo_path, f_skatt_text, signature_text, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            company_name = excluded.company_name, address_line1 = excluded.address_line1,
            postal_code = excluded.postal_code, city = excluded.city, country = excluded.country,
            org_number = excluded.org_number, vat_number = excluded.vat_number, phone = excluded.phone,
            email = excluded.email, website = excluded.website, bankgiro = excluded.bankgiro,
            iban = excluded.iban, bic_swift = excluded.bic_swift, logo_path = excluded.logo_path,
            f_skatt_text = excluded.f_skatt_text, signature_text = excluded.signature_text,
            updated_at = CURRENT_TIMESTAMP;
    `;
    const params = [
        company_name, address_line1, postal_code, city, country, org_number, vat_number, phone, email, 
        website, bankgiro, iban, bic_swift, logo_path, f_skatt_text, signature_text
    ];
    db.run(upsertSql, params, function(err) {
        if (err) {
            console.error("Fel vid uppdatering/skapande av företagsprofil: ", err.message);
            return res.status(500).json({ error: "Databasfel vid sparande av profil." });
        }
        res.json({ message: "Företagsprofil sparad!", data: { id: 1, ...req.body }});
    });
});

app.post('/api/kunder', isAuthenticated, (req, res) => {
  const { 
    company_name, contact_person, org_number, vat_number, 
    email, phone, address, postal_code, city, country 
  } = req.body;
  const sql = `INSERT INTO Kunder 
    (company_name, contact_person, org_number, vat_number, email, phone, address, postal_code, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    company_name, contact_person, org_number, vat_number, 
    email, phone, address, postal_code, city, country || 'Sverige'
  ];
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Fel vid spara kund: ", err.message);
      res.status(400).json({ "error": err.message });
      return;
    }
    res.status(201).json({
      "message": "Kund tillagd!",
      "data": { id: this.lastID, ...req.body, country: country || 'Sverige' }
    });
  });
});
app.get('/api/kunder', isAuthenticated, (req, res) => {
  const sql = "SELECT * FROM Kunder ORDER BY company_name COLLATE NOCASE ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({"error": err.message});
      return;
    }
    res.json({
      "message": "Lista på kunder hämtad",
      "data": rows
    });
  });
});
app.put('/api/kunder/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const { 
    company_name, contact_person, org_number, vat_number, 
    email, phone, address, postal_code, city, country 
  } = req.body;
  const sql = `UPDATE Kunder SET
    company_name = ?, contact_person = ?, org_number = ?, vat_number = ?,
    email = ?, phone = ?, address = ?, postal_code = ?, city = ?, country = ?
    WHERE id = ?`;
  const params = [
    company_name, contact_person, org_number, vat_number, 
    email, phone, address, postal_code, city, country || 'Sverige',
    id
  ];
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Fel vid uppdatering av kund: ", err.message);
      res.status(400).json({ "error": err.message });
      return;
    }
    if (this.changes === 0) {
        res.status(404).json({ "message": "Kund hittades inte" });
        return;
    }
    res.json({
      "message": "Kund uppdaterad!",
      "data": { id: id, ...req.body, country: country || 'Sverige' }
    });
  });
});
app.delete('/api/kunder/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const updateQuotesSql = "UPDATE Offerter SET customer_id = NULL WHERE customer_id = ?";
  db.run(updateQuotesSql, [id], function(err) {
    if (err) {
        console.error("Fel vid avknoppning av kund från offerter: ", err.message);
        res.status(500).json({ "error": "Internt serverfel vid uppdatering av offerter." });
        return;
    }
    const deleteSql = 'DELETE FROM Kunder WHERE id = ?';
    db.run(deleteSql, [id], function(err) {
        if (err) {
            console.error("Fel vid radering av kund: ", err.message);
            res.status(400).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "message": "Kund hittades inte" });
            return;
        }
        res.json({ "message": "Kund raderad! Offerter som var kopplade har avknoppats.", "id": id });
    });
  });
});

app.post('/api/artiklar', isAuthenticated, (req, res) => {
    let { article_number, name, unit, default_price_excl_vat, notes } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Artikelnamn måste anges." });
    }
    function saveArticle(finalArticleNumber) {
        const sql = `INSERT INTO Artiklar (article_number, name, unit, default_price_excl_vat, notes) 
                     VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [finalArticleNumber, name, unit, default_price_excl_vat, notes], function(err) {
            if (err) {
                console.error("Fel vid spara artikel: ", err.message);
                if (err.message.includes('UNIQUE constraint failed: Artiklar.article_number') && finalArticleNumber) {
                    return res.status(409).json({ error: `Artikelnummer ${finalArticleNumber} genererades men används redan. Försök igen.` });
                }
                return res.status(500).json({ error: "Databasfel vid spara av artikel." });
            }
            res.status(201).json({ 
                message: "Artikel skapad!", 
                data: { id: this.lastID, article_number: finalArticleNumber, name, unit, default_price_excl_vat, notes }
            });
        });
    }
    if (!article_number || article_number.trim() === '') {
        db.get("SELECT article_number FROM Artiklar WHERE article_number LIKE 'ART-%' ORDER BY CAST(SUBSTR(article_number, 5) AS INTEGER) DESC LIMIT 1", (err, row) => {
            let nextNum = 1;
            if (row && row.article_number) {
                try {
                    const numPart = parseInt(row.article_number.substring(4));
                    if (!isNaN(numPart)) nextNum = numPart + 1;
                } catch (e) { /* Ignorera */ }
            }
            const generatedArticleNumber = `ART-${String(nextNum).padStart(4, '0')}`;
            db.get("SELECT id FROM Artiklar WHERE article_number = ?", [generatedArticleNumber], (err, existing) => {
                if (existing) saveArticle(`${generatedArticleNumber}-${Date.now().toString().slice(-4)}`);
                else saveArticle(generatedArticleNumber);
            });
        });
    } else {
        saveArticle(article_number);
    }
});
app.get('/api/artiklar', isAuthenticated, (req, res) => {
    const sql = "SELECT * FROM Artiklar ORDER BY name COLLATE NOCASE ASC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Fel vid hämtning av artiklar: ", err.message);
            return res.status(500).json({ error: "Databasfel vid hämtning av artiklar." });
        }
        res.json({ message: "Artiklar hämtade", data: rows });
    });
});
app.get('/api/artiklar/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM Artiklar WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error("Fel vid hämtning av specifik artikel: ", err.message);
            return res.status(500).json({ error: "Databasfel vid hämtning av artikel." });
        }
        if (!row) {
            return res.status(404).json({ error: "Artikel hittades inte." });
        }
        res.json({ message: "Artikel hämtad", data: row });
    });
});
app.put('/api/artiklar/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    let { article_number, name, unit, default_price_excl_vat, notes } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Artikelnamn måste anges." });
    }
    if (article_number !== undefined && article_number.trim() === '') article_number = null;
    const sql = `UPDATE Artiklar SET 
                    article_number = ?, name = ?, unit = ?, default_price_excl_vat = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    db.run(sql, [article_number, name, unit, default_price_excl_vat, notes, id], function(err) {
        if (err) {
            console.error("Fel vid uppdatering av artikel: ", err.message);
            if (err.message.includes('UNIQUE constraint failed: Artiklar.article_number') && article_number) {
                return res.status(400).json({ error: `Artikelnummer ${article_number} används redan av en annan artikel.` });
            }
            return res.status(500).json({ error: "Databasfel vid uppdatering av artikel." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Artikel att uppdatera hittades inte." });
        }
        res.json({ 
            message: "Artikel uppdaterad!", 
            data: { id: Number(id), article_number, name, unit, default_price_excl_vat, notes }
        });
    });
});
app.delete('/api/artiklar/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const updateOffertraderSql = "UPDATE Offertrader SET article_id = NULL WHERE article_id = ?";
    db.run(updateOffertraderSql, [id], function(err) {
        if (err) {
            console.error("Fel vid avknoppning av artikel från offertrader: ", err.message);
            return res.status(500).json({ error: "Internt serverfel vid uppdatering av offertrader." });
        }
        const deleteArtikelSql = "DELETE FROM Artiklar WHERE id = ?";
        db.run(deleteArtikelSql, [id], function(delErr) {
            if (delErr) {
                console.error("Fel vid radering av artikel: ", delErr.message);
                return res.status(500).json({ error: "Databasfel vid radering av artikel." });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Artikel att radera hittades inte." });
            }
            res.json({ message: "Artikel raderad! Eventuella kopplingar i offertrader har tagits bort." });
        });
    });
});

app.get('/api/offerter/next-number', isAuthenticated, (req, res) => { /* Befintlig kod */ });
app.post('/api/offerter', isAuthenticated, (req, res) => { /* Befintlig kod */ });
app.put('/api/offerter/:id', isAuthenticated, (req, res) => { /* Befintlig kod */ });
app.put('/api/offerter/:id/status', isAuthenticated, (req, res) => { /* Befintlig kod */ });
app.get('/api/offerter', isAuthenticated, (req, res) => { /* Befintlig kod */ });
app.get('/api/offerter/:id', isAuthenticated, (req, res) => { /* Befintlig kod */ });

app.get('/api/offerter/:id/preview', isAuthenticated, async (req, res) => {
    const quoteId = req.params.id;
    try {
        const profileRow = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM Foretagsprofil WHERE id = 1", [], (err, row) => {
                if (err) { reject(err); } else { resolve(row || {}); }
            });
        });
        const quoteSql = `
            SELECT o.*, k.company_name AS customer_company_name, k.contact_person AS customer_contact_person,
                   k.address AS customer_address, k.postal_code AS customer_postal_code, k.city AS customer_city
            FROM Offerter o LEFT JOIN Kunder k ON o.customer_id = k.id WHERE o.id = ?`;
        const quote = await new Promise((resolve, reject) => {
            db.get(quoteSql, [quoteId], (err, row) => {
                if (err) { reject(err); }
                else if (!row) { reject(new Error('Offert hittades inte')); }
                else { resolve(row); }
            });
        });
        const itemsSql = "SELECT * FROM Offertrader WHERE quote_id = ? ORDER BY id ASC";
        quote.items = await new Promise((resolve, reject) => {
            db.all(itemsSql, [quoteId], (err, rows) => {
                if (err) { reject(err); } else { resolve(rows || []); }
            });
        });
        const templateData = {
            companyProfile: profileRow, quote: quote,
            formatted_quote_date: quote.quote_date ? Handlebars.helpers.formatDate(quote.quote_date) : '-',
            formatted_valid_until_date: quote.valid_until_date ? Handlebars.helpers.formatDate(quote.valid_until_date) : '-',
            vat_amount: (parseFloat(quote.total_amount_excl_vat || 0) * (parseFloat(quote.vat_percentage || 25) / 100)),
        };
        if (templateData.companyProfile.logo_path && templateData.companyProfile.logo_path.trim() !== '') {
            const logoAbsolutePath = path.join(__dirname, 'public', templateData.companyProfile.logo_path);
            if (fs.existsSync(logoAbsolutePath)) {
                const logoBuffer = fs.readFileSync(logoAbsolutePath);
                templateData.companyProfile.logo_path_full = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } else {
                 templateData.companyProfile.logo_path_full = null;
            }
        } else {
            templateData.companyProfile.logo_path_full = null;
        }
        templateData.quote.items = templateData.quote.items.map(item => ({
            ...item,
            quantity_formatted: new Intl.NumberFormat('sv-SE').format(item.quantity),
            unit_price_formatted: Handlebars.helpers.formatPrice(item.unit_price_excl_vat),
            discount_display: item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-',
            line_total_formatted: Handlebars.helpers.formatPrice(item.line_total_excl_vat)
        }));
        templateData.total_amount_excl_vat_formatted = Handlebars.helpers.formatPrice(templateData.quote.total_amount_excl_vat);
        templateData.vat_amount_formatted = Handlebars.helpers.formatPrice(templateData.vat_amount);
        templateData.total_amount_incl_vat_formatted_with_sek = Handlebars.helpers.formatPrice(templateData.quote.total_amount_incl_vat, true, 'SEK');
        if (templateData.quote.internal_notes) {
            templateData.quote.internal_notes_formatted = Handlebars.helpers.nl2br(templateData.quote.internal_notes);
        }
        const templateHtmlPath = path.join(__dirname, 'views', 'offert-template.html');
        const templateHtml = fs.readFileSync(templateHtmlPath, 'utf8');
        const template = Handlebars.compile(templateHtml);
        const finalHtml = template(templateData);
        res.set({ 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(finalHtml, 'utf8') });
        res.send(finalHtml);
    } catch (error) {
        console.error("Fel vid generering av HTML-förhandsgranskning: ", error);
        res.status(500).send(`Kunde inte generera HTML-förhandsgranskning: ${error.message}`);
    }
});

app.get('/api/offerter/:id/pdf', isAuthenticated, async (req, res) => {
    const quoteId = req.params.id;
    try {
        const profileRow = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM Foretagsprofil WHERE id = 1", [], (err, row) => {
                if (err) { reject(err); } else { resolve(row || {}); }
            });
        });
        const quoteSql = `
            SELECT o.*, k.company_name AS customer_company_name, k.contact_person AS customer_contact_person,
                   k.address AS customer_address, k.postal_code AS customer_postal_code, k.city AS customer_city
            FROM Offerter o LEFT JOIN Kunder k ON o.customer_id = k.id WHERE o.id = ?`;
        const quote = await new Promise((resolve, reject) => {
            db.get(quoteSql, [quoteId], (err, row) => {
                if (err) { reject(err); }
                else if (!row) { reject(new Error('Offert hittades inte')); }
                else { resolve(row); }
            });
        });
        const itemsSql = "SELECT * FROM Offertrader WHERE quote_id = ? ORDER BY id ASC";
        quote.items = await new Promise((resolve, reject) => {
            db.all(itemsSql, [quoteId], (err, rows) => {
                if (err) { reject(err); } else { resolve(rows || []); }
            });
        });
        const templateData = {
            companyProfile: profileRow, quote: quote,
            formatted_quote_date: quote.quote_date ? Handlebars.helpers.formatDate(quote.quote_date) : '-',
            formatted_valid_until_date: quote.valid_until_date ? Handlebars.helpers.formatDate(quote.valid_until_date) : '-',
            vat_amount: (parseFloat(quote.total_amount_excl_vat || 0) * (parseFloat(quote.vat_percentage || 25) / 100)),
        };
        if (templateData.companyProfile.logo_path && templateData.companyProfile.logo_path.trim() !== '') {
            const logoAbsolutePath = path.join(__dirname, 'public', templateData.companyProfile.logo_path);
            if (fs.existsSync(logoAbsolutePath)) {
                const logoBuffer = fs.readFileSync(logoAbsolutePath);
                templateData.companyProfile.logo_path_full = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } else {
                templateData.companyProfile.logo_path_full = null;
            }
        } else {
            templateData.companyProfile.logo_path_full = null;
        }
        templateData.quote.items = templateData.quote.items.map(item => ({
            ...item,
            quantity_formatted: new Intl.NumberFormat('sv-SE').format(item.quantity),
            unit_price_formatted: Handlebars.helpers.formatPrice(item.unit_price_excl_vat),
            discount_display: item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-',
            line_total_formatted: Handlebars.helpers.formatPrice(item.line_total_excl_vat)
        }));
        templateData.total_amount_excl_vat_formatted = Handlebars.helpers.formatPrice(templateData.quote.total_amount_excl_vat);
        templateData.vat_amount_formatted = Handlebars.helpers.formatPrice(templateData.vat_amount);
        templateData.total_amount_incl_vat_formatted_with_sek = Handlebars.helpers.formatPrice(templateData.quote.total_amount_incl_vat, true, 'SEK');
        if (templateData.quote.internal_notes) {
            templateData.quote.internal_notes_formatted = Handlebars.helpers.nl2br(templateData.quote.internal_notes);
        }
        const templateHtmlPath = path.join(__dirname, 'views', 'offert-template.html');
        const templateHtml = fs.readFileSync(templateHtmlPath, 'utf8');
        const template = Handlebars.compile(templateHtml);
        const finalHtml = template(templateData);
        
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']});
        const page = await browser.newPage();
        const baseUrl = `file://${path.join(__dirname, 'public')}/`;
        await page.setContent(finalHtml, { waitUntil: 'networkidle0', timeout: 60000 });
        const pdfBuffer = await page.pdf({
            format: 'A4', printBackground: true,
            margin: { top: '30mm', right: '20mm', bottom: '25mm', left: '20mm' }
        });
        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="offert-${quote.quote_number}.pdf"`
        });
        res.end(pdfBuffer);
    } catch (error) {
        console.error("Komplett fel vid generering av PDF: ", error);
        res.status(500).send(`Kunde inte generera PDF: ${error.message}`);
    }
});

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Servern körs på http://${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`Tillgänglig externt (t.ex. via serverns IP-adress eller domännamn).`);
  } else {
    console.log(`Endast tillgänglig lokalt.`);
  }
  console.log(`NODE_ENV är satt till: ${process.env.NODE_ENV || 'development (default)'}`);
  console.log(`OBS: För produktion, se till att NODE_ENV=production och att SESSION_SECRET är satt till en stark, unik nyckel.`);
});
