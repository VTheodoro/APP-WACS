# ♿ WACS - Wheelchair Accessible Control System

**WACS** (Sistema de Controle de Cadeira de Rodas Acessível) é uma aplicação móvel inovadora desenvolvida para transformar a experiência de mobilidade de pessoas com deficiência. O projeto integra controle de hardware (cadeira de rodas motorizada), navegação inteligente focada em acessibilidade, e uma rede social inclusiva.

---

## 🚀 Visão Geral do Projeto

O WACS não é apenas um controle remoto; é um ecossistema completo de assistência. Ele combina tecnologias modernas (React Native, Firebase, IoT) para oferecer:

1.  **Controle Remoto Universal**: Interface para controlar cadeiras de rodas via Bluetooth/Wi-Fi.
2.  **Navegação Acessível**: Mapas que destacam rotas sem barreiras e locais adaptados.
3.  **Rede Social Inclusiva**: Conecta usuários para compartilhar experiências e avaliações de locais.
4.  **Gamificação**: Incentiva a colaboração da comunidade através de pontos e conquistas.

---

## 📱 Funcionalidades Principais

### 1. Controle & Hardware (`/src/screens/ControlScreen.js`)
- **Joystick Virtual**: Controle preciso da cadeira com interface sensível ao toque.
- **Modos de Velocidade**: Eco, Normal e Sport.
- **Comandos de Voz**: Controle total por voz ("Para frente", "Parar", "Luzes").
- **Telemetria**: Monitoramento em tempo real de bateria, temperatura e conexão.

### 2. Navegação Inteligente (`/src/screens/MapScreen.js`)
- **Rotas Acessíveis**: Algoritmos que priorizam caminhos com rampas e calçadas adequadas.
- **Mapeamento Colaborativo**: Usuários podem adicionar e avaliar locais (banheiros adaptados, estacionamento).
- **Alertas de Obstáculos**: Avisos visuais e sonoros sobre buracos ou barreiras na via.

### 3. Rede Social & Chat (`/src/screens/social`)
- **Feed de Comunidade**: Compartilhamento de fotos e histórias.
- **Chats Regionais**: Salas de bate-papo organizadas por cidade (ex: Vale do Ribeira) para conectar pessoas próximas.
- **Avaliações Detalhadas**: Sistema de review focado em critérios de acessibilidade.

### 4. Gamificação (`/src/features/gamification`)
- **Sistema de Níveis**: Usuários ganham XP ao contribuir com o mapa ou ajudar outros.
- **Conquistas**: Medalhas por engajamento (ex: "Explorador", "Guia Local").

---

## 🛠️ Arquitetura Técnica

O projeto segue uma arquitetura moderna e escalável:

### Front-end (Mobile)
- **Framework**: React Native (Expo SDK 52).
- **Linguagem**: JavaScript (ES6+).
- **Navegação**: React Navigation (Stack & Tabs).
- **Mapas**: `react-native-maps` com integração Google Maps API.
- **Comunicação**: `react-native-ble-plx` (Bluetooth) e `socket.io-client` (Real-time).

### Back-end (BaaS)
- **Plataforma**: Firebase.
- **Auth**: Autenticação de usuários (Email/Senha).
- **Firestore**: Banco de dados NoSQL em tempo real.
- **Storage**: Armazenamento de mídias (fotos de perfil, posts).

### Hardware (IoT)
- **Microcontrolador**: Arduino / ESP32.
- **Protocolo**: Comunicação via HTTP (Wi-Fi) ou BLE (Bluetooth Low Energy).

---

## 💾 Estrutura do Banco de Dados (Firestore)

O banco de dados é estruturado em coleções principais para garantir performance e escalabilidade:

### `users` (Coleção)
Armazena perfis de usuários.
- `uid`: Identificador único.
- `mobilityType`: Tipo de mobilidade (Cadeira motorizada, manual, etc.).
- `xp`: Pontos de experiência acumulados.

### `accessibleLocations` (Coleção)
Locais mapeados pela comunidade.
- `location`: GeoPoint (Latitude/Longitude).
- `features`: Array de tags (ex: `['ramp', 'bathroom']`).
- `featureRatings`: Média de avaliações por critério.

### `posts` (Coleção)
Feed da rede social.
- `imageUrl`: Link da imagem no Firebase Storage.
- `likes`: Array de UIDs que curtiram.
- **Sub-coleção `comments`**: Comentários do post.

### `chats` (Coleção)
Salas de bate-papo.
- `type`: 'regional' ou 'cidade'.
- `members`: Lista de participantes ativos.

---

## 📂 Estrutura de Pastas

```
src/
├── components/     # Componentes reutilizáveis (Botões, Cards, Inputs)
├── config/         # Configurações globais (Firebase, API Keys)
├── contexts/       # React Contexts (Auth, Bluetooth, Navigation)
├── features/       # Módulos funcionais (Gamificação, Contribuições)
├── navigation/     # Configuração de rotas (AppNavigator)
├── screens/        # Telas da aplicação (Control, Map, Social, Profile)
├── services/       # Integrações externas (Arduino, Firebase API)
└── utils/          # Funções auxiliares e formatadores
```

---

## 🚀 Como Executar

1.  **Pré-requisitos**: Node.js, npm/yarn, Expo CLI.
2.  **Instalação**:
    ```bash
    npm install
    ```
3.  **Configuração**:
    - Crie um projeto no Firebase.
    - Adicione as credenciais em `src/config/firebase.js`.
    - Adicione sua Google Maps API Key em `app.json` ou `.env`.
4.  **Execução**:
    ```bash
    npx expo start
    ```

---

## 🤝 Contribuição

Este é um projeto Open Source focado em impacto social. Contribuições são bem-vindas, especialmente em:
- Melhorias nos algoritmos de rota acessível.
- Novas integrações de hardware.
- Traduções e acessibilidade da interface (i18n, a11y).

---

**Desenvolvido com ❤️ para um mundo mais acessível.**