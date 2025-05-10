const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

// Korrekt sökväg från scripts-mappen till db-mappen
const dbPath = path.join(__dirname, '../db/offert_db.sqlite'); 
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Kunde inte ansluta till databasen:', err.message);
        process.exit(1); // Avsluta om databasen inte kan nås
    }
    console.log('Ansluten till SQLite-databasen för användarregistrering.');
});

const saltRounds = 10; 

readline.question('Ange önskat användarnamn: ', (username) => {
    readline.question('Ange önskat lösenord (minst 6 tecken): ', async (password) => {
        if (!username || username.trim() === '' || !password || password.length < 6) {
            console.error('Fel: Användarnamn måste anges och lösenord måste vara minst 6 tecken långt.');
            db.close();
            readline.close();
            return;
        }

        try {
            // Kontrollera först om Users-tabellen finns, annars kan scriptet misslyckas om det körs innan app.js
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Users'", async (err, table) => {
                if (err) {
                    console.error('Databasfel vid kontroll av Users-tabell:', err.message);
                    db.close();
                    readline.close();
                    return;
                }
                if (!table) {
                    console.error('Fel: Users-tabellen verkar inte finnas. Kör applikationen (app.js) först för att skapa tabellerna.');
                    db.close();
                    readline.close();
                    return;
                }

                const hashedPassword = await bcrypt.hash(password, saltRounds);
                db.run("INSERT INTO Users (username, password_hash) VALUES (?, ?)", [username.trim(), hashedPassword], function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            console.error(`Fel: Användarnamnet '${username.trim()}' är redan upptaget.`);
                        } else {
                            console.error('Fel vid skapande av användare:', err.message);
                        }
                    } else {
                        console.log(`Användare '${username.trim()}' skapad med ID: ${this.lastID}`);
                        console.log('Du kan nu logga in med dessa uppgifter.');
                    }
                    db.close((closeErr) => {
                        if (closeErr) console.error("Fel vid stängning av databas:", closeErr.message);
                    });
                    readline.close();
                });
            });
        } catch (hashError) {
            console.error('Fel vid hashning av lösenord:', hashError);
            db.close();
            readline.close();
        }
    });
});

process.on('exit', (code) => {
  console.log(`Scriptet avslutas med kod ${code}`);
});
