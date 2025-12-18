import { useEffect, useRef } from 'react';

/**
 * Componente PluggyConnect - Integração com Pluggy Connect via iframe
 */
export function PluggyConnect({ connectToken, onSuccess, onError }) {
  const containerRef = useRef(null);
  const messageHandlerRef = useRef(null);

  useEffect(() => {
    console.log('[PluggyConnect] ============================================');
    console.log('[PluggyConnect] INICIANDO');
    console.log('[PluggyConnect] Token recebido:', connectToken ? connectToken.substring(0, 50) + '...' : 'NENHUM');
    console.log('[PluggyConnect] Tipo:', typeof connectToken);
    console.log('[PluggyConnect] Tamanho:', connectToken ? connectToken.length : 0);
    
    if (!connectToken) {
      console.error('[PluggyConnect] ❌ Token não fornecido');
      if (onError) {
        onError(new Error('Token de conexão não fornecido'));
      }
      return;
    }

    if (typeof connectToken !== 'string') {
      console.error('[PluggyConnect] ❌ Token não é string:', typeof connectToken);
      if (onError) {
        onError(new Error('Token deve ser uma string'));
      }
      return;
    }

    if (!containerRef.current) {
      console.error('[PluggyConnect] ❌ Container não disponível');
      return;
    }

    const token = connectToken.trim();
    console.log('[PluggyConnect] ✅ Token válido, criando iframe...');

    // Limpar container
    containerRef.current.innerHTML = '';

    // Criar iframe com a URL de conexão Pluggy
    const iframe = document.createElement('iframe');
    
    // O Pluggy Connect espera o token como query parameter na URL
    // Formato: https://connect.pluggy.ai/?connectToken=TOKEN_AQUI
    const url = `https://connect.pluggy.ai/?connectToken=${encodeURIComponent(token)}`;
    
    console.log('[PluggyConnect] ============================================');
    console.log('[PluggyConnect] Criando iframe com token');
    console.log('[PluggyConnect] URL completa (primeiros 200 chars):', url.substring(0, 200) + '...');
    console.log('[PluggyConnect] Token codificado na URL:', url.includes('connectToken='));
    console.log('[PluggyConnect] Token length:', token.length);
    console.log('[PluggyConnect] Token completo (para debug):', token);
    console.log('[PluggyConnect] ============================================');
    
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.allow = 'camera; microphone; payment';
    // Remover sandbox para permitir comunicação completa com o Pluggy Connect
    iframe.title = 'Pluggy Connect';

    // Listener para quando o iframe carregar
    iframe.onload = () => {
      console.log('[PluggyConnect] ✅ Iframe Pluggy Connect carregado');
      console.log('[PluggyConnect] URL atual:', iframe.src.substring(0, 150) + '...');
    };

    iframe.onerror = (error) => {
      console.error('[PluggyConnect] ❌ Erro ao carregar iframe:', error);
      if (onError) {
        onError(new Error('Erro ao carregar iframe do Pluggy Connect'));
      }
    };

    containerRef.current.appendChild(iframe);
    console.log('[PluggyConnect] ✅ Iframe adicionado ao DOM');

    // Escutar mensagens do iframe (postMessage)
    const handleMessage = (event) => {
      console.log('[PluggyConnect] ============================================');
      console.log('[PluggyConnect] Mensagem recebida');
      console.log('[PluggyConnect] Origem:', event.origin);
      console.log('[PluggyConnect] Dados completos:', JSON.stringify(event.data, null, 2));
      console.log('[PluggyConnect] Tipo dos dados:', typeof event.data);
      console.log('[PluggyConnect] ============================================');

      // Verificar origem (permitir múltiplas origens do Pluggy)
      const allowedOrigins = [
        'https://connect.pluggy.ai',
        'https://api.pluggy.ai',
        'https://demo.pluggy.ai',
        'https://*.pluggy.ai'
      ];
      
      const isAllowedOrigin = allowedOrigins.some(origin => {
        if (origin.includes('*')) {
          const pattern = origin.replace('*', '.*');
          return new RegExp(pattern).test(event.origin);
        }
        return event.origin === origin;
      });

      if (!isAllowedOrigin) {
        console.log('[PluggyConnect] Origem não permitida, ignorando:', event.origin);
        return;
      }

      // Verificar diferentes formatos de resposta
      if (event.data) {
        let itemId = null;

        // Formato 1: Objeto com itemId
        if (event.data.itemId) {
          itemId = event.data.itemId;
        }
        // Formato 2: Objeto com id
        else if (event.data.id) {
          itemId = event.data.id;
        }
        // Formato 3: String direta (UUID)
        else if (typeof event.data === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.data)) {
          itemId = event.data;
        }
        // Formato 4: Objeto aninhado
        else if (event.data.data && event.data.data.itemId) {
          itemId = event.data.data.itemId;
        }
        // Formato 5: Objeto com type e payload
        else if (event.data.type === 'PLUGGY_CONNECT_SUCCESS' && event.data.payload) {
          itemId = event.data.payload.itemId || event.data.payload.id;
        }

        if (itemId) {
          console.log('[PluggyConnect] ✅ ItemId extraído:', itemId);
          if (onSuccess) {
            onSuccess(itemId);
          }
          return;
        }

        // Verificar erros
        if (event.data.type === 'PLUGGY_CONNECT_ERROR' || event.data.error) {
          const errorMsg = event.data.message || event.data.error || 'Erro ao conectar';
          console.error('[PluggyConnect] ❌ Erro do iframe:', errorMsg);
          if (onError) {
            onError(new Error(errorMsg));
          }
          return;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    messageHandlerRef.current = handleMessage;
    console.log('[PluggyConnect] ✅ Listener de mensagens adicionado');

    // Cleanup
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [connectToken, onSuccess, onError]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full min-h-[600px]">
        {!connectToken && (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Aguardando token...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
