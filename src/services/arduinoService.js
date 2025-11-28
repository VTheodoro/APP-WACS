// Substitua pelo IP da sua máquina na rede local
// Exemplo: 'http://192.168.1.100:3001'
// Para descobrir seu IP no Windows: abra o prompt de comando e digite 'ipconfig'
const ARDUINO_SERVER_URL = 'http://192.168.1.100:3001';

// Função para simular conexão em desenvolvimento
const simulateConnection = () => {

  return new Promise(resolve => {
    setTimeout(() => {

      resolve({ success: true, port: 'COM3' });
    }, 1000);
  });
};

export const connectToArduino = async (port) => {
  try {

    
    // Em desenvolvimento, usa a simulação
    if (__DEV__) {

      return await simulateConnection();
    }
    
    // Em produção, tenta conectar ao servidor

    const response = await fetch(`${ARDUINO_SERVER_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: port })
    });
    
    const result = await response.json();

    
    if (result && result.ok) {

      await sendCommand('conectar');
      return { success: true, port: result.path };
    }
    
    return { 
      success: false, 
      error: result?.error || 'Falha ao conectar ao Arduino' 
    };
  } catch (error) {
    console.error('Erro ao conectar ao Arduino:', error);
    return { 
      success: false, 
      error: `Erro de rede: ${error.message}. Verifique se o servidor está rodando em ${ARDUINO_SERVER_URL}` 
    };
  }
};

export const sendCommand = async (command) => {
  try {

    
    // Em desenvolvimento, retorna sucesso imediatamente
    if (__DEV__) {

      return true;
    }
    
    const response = await fetch(`${ARDUINO_SERVER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: command })
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('Erro ao enviar comando:', error);
    return false;
  }
};

export const checkConnection = async () => {
  try {
    // Em desenvolvimento, sempre retorna true
    if (__DEV__) {

      return true;
    }
    
    const response = await fetch(`${ARDUINO_SERVER_URL}/status`);
    const status = await response.json();
    return status.serialOpen;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return false;
  }
};
