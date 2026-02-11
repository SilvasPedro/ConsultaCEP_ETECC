// --- VARIÁVEIS GLOBAIS ---
let dbCeps = []; // Armazena todos os CEPs carregados do CSV
let isDbLoaded = false;

// --- INICIALIZAÇÃO: Carrega o CSV assim que a página abre ---
document.addEventListener('DOMContentLoaded', () => {
    loadCsvDatabase();
});

async function loadCsvDatabase() {
    try {
        // Busca o arquivo que você enviou: 'ceps.csv'
        const req = await fetch('ceps.csv');
        if (!req.ok) throw new Error("Erro ao carregar ceps.csv");
        const text = await req.text();

        const rows = text.split('\n');
        // Começa do 1 para pular o cabeçalho (CEP,LOGRADOURO,BAIRRO,CIDADE)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;

            // O seu arquivo usa VÍRGULA como separador
            const cols = row.split(','); 
            
            if (cols.length >= 4) {
                dbCeps.push({
                    cep: cols[0].trim(),
                    logradouro: cols[1].trim(),
                    bairro: cols[2].trim(),
                    cidade: cols[3].trim()
                });
            }
        }
        isDbLoaded = true;
        console.log(`Base carregada: ${dbCeps.length} endereços.`);
    } catch (err) {
        console.error(err);
        document.getElementById('msg-address').innerText = "Erro: Não foi possível carregar a base de CEPs.";
        document.getElementById('msg-address').className = "status-msg error";
    }
}

// --- LÓGICA DE ABAS ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabName}`).classList.add('active');
    
    if(tabName === 'cep') document.getElementById('input-cep').focus();
    else document.getElementById('input-street').focus();
}

// --- UTILITÁRIOS ---
function showToast(text) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`CEP ${text} copiado!`);
    });
}

// --- MÓDULO 1: BRASIL API (Busca por CEP - Mantido igual) ---
const formCep = document.getElementById('form-cep');
const inputCep = document.getElementById('input-cep');

inputCep.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
    e.target.value = v;
});

formCep.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cep = inputCep.value.replace(/\D/g, '');
    const msgEl = document.getElementById('msg-cep');
    const resBox = document.getElementById('result-cep');

    if (cep.length !== 8) {
        msgEl.textContent = "CEP inválido."; msgEl.className = "status-msg error"; return;
    }

    msgEl.textContent = "Consultando..."; msgEl.className = "status-msg";
    resBox.style.display = 'none';

    try {
        // Tenta achar na base local primeiro para ser mais rápido
        const localResult = dbCeps.find(item => item.cep.replace(/\D/g, '') === cep);

        if (localResult) {
            fillCepData(localResult.logradouro, localResult.bairro, localResult.cidade, localResult.cep);
            msgEl.textContent = "";
            resBox.style.display = 'block';
        } else {
            // Fallback para API se não achar no CSV
            const req = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
            if (!req.ok) throw new Error();
            const data = await req.json();
            fillCepData(data.street, data.neighborhood, `${data.city} - ${data.state}`, data.cep);
            msgEl.textContent = "";
            resBox.style.display = 'block';
        }
    } catch (err) {
        msgEl.textContent = "CEP não encontrado.";
        msgEl.className = "status-msg error";
    }
});

function fillCepData(logradouro, bairro, cidade, cep) {
    document.getElementById('res-street').textContent = logradouro || '---';
    document.getElementById('res-neighborhood').textContent = bairro || '---';
    document.getElementById('res-city-uf').textContent = cidade;
    const badge = document.getElementById('res-cep-badge');
    badge.textContent = cep;
    badge.onclick = () => copyToClipboard(cep);
}

// --- MÓDULO 2: BUSCA EM TEMPO REAL NO CSV ---
const inputStreet = document.getElementById('input-street');
// Previne o submit do formulário para não recarregar a página
document.getElementById('form-address').addEventListener('submit', (e) => e.preventDefault());

// Evento principal: Dispara enquanto digita
inputStreet.addEventListener('input', function() {
    const term = this.value.toLowerCase().trim();
    const listEl = document.getElementById('result-list');
    const msgEl = document.getElementById('msg-address');

    // Limpa resultados anteriores
    listEl.innerHTML = '';
    
    if (!isDbLoaded) {
        msgEl.textContent = "Aguarde, carregando base de dados...";
        return;
    }

    if (term.length < 3) {
        listEl.style.display = 'none';
        msgEl.textContent = ""; // Limpa msg se for curto
        return;
    }

    // Filtragem
    // Filtra por rua e opcionalmente por cidade se o input-city estiver preenchido
    const cityFilter = document.getElementById('input-city').value.toLowerCase().trim();
    
    const results = dbCeps.filter(item => {
        const matchStreet = item.logradouro.toLowerCase().includes(term);
        const matchCity = cityFilter === '' || item.cidade.toLowerCase().includes(cityFilter);
        return matchStreet && matchCity;
    });

    // Limite de resultados para não travar a tela se tiver muitos
    const maxResults = 50; 
    const displayResults = results.slice(0, maxResults);

    if (displayResults.length === 0) {
        msgEl.textContent = "Nenhum endereço encontrado.";
        msgEl.className = "status-msg";
        listEl.style.display = 'none';
    } else {
        msgEl.textContent = results.length > maxResults 
            ? `Mostrando ${maxResults} de ${results.length} resultados...` 
            : `${results.length} resultados encontrados.`;
        msgEl.className = "status-msg success";
        listEl.style.display = 'block';

        displayResults.forEach(item => {
            const div = document.createElement('div');
            div.className = 'card-list-item';
            div.innerHTML = `
                <div>
                    <div style="font-weight:600; color:var(--text-main)">${item.logradouro}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted)">${item.bairro} - ${item.cidade}</div>
                </div>
                <div class="cep-badge" onclick="copyToClipboard('${item.cep}')">${item.cep}</div>
            `;
            listEl.appendChild(div);
        });
    }
});