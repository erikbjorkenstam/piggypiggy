# DISTRIBUERA PÅ AZURE – steg för steg

Den här guiden tar dig från "filerna ligger på min dator" till "sajten uppdateras automatiskt varje gång jag pushar till GitHub". Du behöver: ett GitHub-konto (klart), ett Azure-konto (klart) och Git installerat på din dator.

Kör stegen i ordning. Fastnar du någonstans – stanna där, det är bättre att lösa ett steg i taget än att fortsätta på ett osäkert fundament.

---

## Del 1 – Git och GitHub

### 1.1 Kontrollera att Git är installerat
Öppna en terminal (Terminal på Mac, PowerShell/Terminal på Windows) och skriv:
```
git --version
```
Ser du ett versionsnummer är du klar. Annars: ladda ner från [git-scm.com](https://git-scm.com/downloads) och installera med standardinställningarna.

### 1.2 Skapa repot på GitHub
1. Gå till [github.com](https://github.com) → **New repository**.
2. Namn: t.ex. `piggypiggy-adventure`.
3. Lämna det **tomt** (kryssa INTE i "Add a README" – vi har redan filer lokalt).
4. Synlighet: Private eller Public, valfritt (Public kostar inget extra på Static Web Apps Free).
5. **Create repository**. Du landar på en sida med en repo-URL, typ `https://github.com/dittnamn/piggypiggy-adventure.git` — kopiera den.

### 1.3 Initiera Git lokalt och pusha
I mappen på din dator där alla spelfilerna ligger (`index.html`, `engine.js`, `api/`, osv.), kör:
```
git init
git add .
git commit -m "Första commit: PiggyPiggy Adventure"
git branch -M main
git remote add origin https://github.com/DITT-NAMN/piggypiggy-adventure.git
git push -u origin main
```
Byt ut URL:en mot din egen från steg 1.2. Du kan behöva logga in i GitHub (webbläsarfönster öppnas, eller så frågar terminalen efter användarnamn/token).

**Kontrollera:** ladda om GitHub-sidan för repot — filerna ska synas där.

---

## Del 2 – Azure Static Web App

### 2.1 Skapa resursen
1. Gå till [portal.azure.com](https://portal.azure.com) → **Create a resource** → sök på **Static Web App** → **Create**.
2. **Basics**:
   - **Subscription**: din prenumeration.
   - **Resource Group**: skapa en ny, t.ex. `piggypiggy-rg`.
   - **Name**: t.ex. `piggypiggy-adventure`.
   - **Plan type**: **Free**.
   - **Region**: valfri nära dig (t.ex. West Europe).
3. **Deployment details**:
   - **Source**: **GitHub**.
   - Klicka **Sign in with GitHub** och godkänn åtkomst.
   - **Organization**: ditt GitHub-användarnamn.
   - **Repository**: `piggypiggy-adventure`.
   - **Branch**: `main`.
4. **Build Details**:
   - **Build Presets**: välj **Custom** (spelet är rena statiska filer, inget byggsteg).
   - **App location**: `/`
   - **Api location**: `api`
   - **Output location**: *(lämna tomt)*
5. **Review + Create** → **Create**.

Azure gör två saker automatiskt: skapar hosting-resursen **och** committar en ny fil `.github/workflows/azure-static-web-apps-<slumpat-namn>.yml` till ditt GitHub-repo. Den filen är receptet för att bygga och deploya varje gång du pushar.

### 2.2 Vänta in första deployen
1. När resursen är skapad, gå till den (**Go to resource**).
2. På översiktssidan finns en banner/länk till GitHub Actions-körningen. Klicka dig dit och vänta tills den blir grön (tar ~1–2 minuter).
3. Gå tillbaka till Azure-resursens översiktssida — där finns din **URL** (typ `https://xxxxx.azurestaticapps.net`). Öppna den. Spelet ska nu ligga live.

Om något går fel: kolla loggen i GitHub Actions-körningen (fliken **Actions** i ditt repo) — den visar oftast exakt vilket steg som brakade.

---

## Del 3 – Molnsynk (Table Storage)

### 3.1 Skapa ett Storage-konto
1. **Create a resource** → sök **Storage account** → **Create**.
2. **Basics**: samma Resource Group som ovan (`piggypiggy-rg`), eget namn (bara små bokstäver/siffror, t.ex. `piggypiggystorage`), **Performance: Standard**, **Redundancy: LRS** (billigast, tillräckligt bra för ett familjeprojekt).
3. **Review + Create** → **Create**.

### 3.2 Hämta anslutningssträngen
1. Gå till det nya Storage-kontot → i vänstermenyn: **Security + networking → Access keys**.
2. Under **key1**, klicka **Show** vid **Connection string** och kopiera hela strängen.

### 3.3 Koppla ihop med Static Web App
1. Gå till din Static Web App-resurs → i vänstermenyn: **Settings → Environment variables** (kan även heta **Application settings** beroende på portalversion).
2. Lägg till två variabler:
   - **Name**: `AZURE_STORAGE_CONNECTION_STRING` → **Value**: strängen du kopierade i 3.2.
   - **Name**: `FAMILY_CODE` → **Value**: valfri hemlig kod ni bestämmer i familjen (t.ex. `piggy1234`).
3. **Save**.

Det tar vanligen under en minut innan Functions-delen plockar upp de nya variablerna — ingen ny deploy behövs.

### 3.4 Testa hela kedjan
1. Öppna sajtens URL → **Banbyggaren**.
2. Bygg en liten testbana → **Spara i appen** → ange namnet → när den frågar efter familjekod, skriv den kod du satte i 3.3.
3. Du ska få "Sparad i molnet ☁️✔".
4. Öppna samma URL i en **annan webbläsare** (eller på iPaden) → gå till **★ Mina banor** i menyn eller i Banbyggaren → banan ska synas där, markerad med ☁️.

Fungerar det – klart! Alla enheter som öppnar sajten delar nu samma banor.

---

## Löpande arbete efteråt

Från och med nu: när du ändrar en fil lokalt (nytt tema i `engine.js`, ny bana, vad som helst),
```
git add .
git commit -m "Beskrivning av ändringen"
git push
```
… och Azure bygger och publicerar automatiskt inom någon minut. Du kan följa med i **Actions**-fliken på GitHub-repot.

## Felsökning
- **Vit sida / 404 på sajten**: kolla att GitHub Actions-körningen är grön; annars öppna loggen och läs felet.
- **"Kunde inte nå molnet" i appen**: `AZURE_STORAGE_CONNECTION_STRING` saknas/fel, eller så har `api/`-mappen inte kommit med i pushen (`git status` lokalt för att se om den är spårad).
- **403 vid spara/ta bort**: fel familjekod, eller `FAMILY_CODE` inte satt i Environment variables.
- **Ändringar i `api/` syns inte**: kom ihåg att pusha — Azure bygger bara det som faktiskt ligger i GitHub-repot, inte det som ligger kvar lokalt.
