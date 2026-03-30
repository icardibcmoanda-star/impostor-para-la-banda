import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type Screen = 'START' | 'LOBBY' | 'INPUT_CUSTOM' | 'REVEAL' | 'VOTING' | 'RESULT';

interface Player {
  id: string;
  name: string;
}

interface GameSettings {
  impostorsKnowEachOther: boolean;
  revealSubCategory: boolean;
  giveImpostorClue: boolean;
}

export default function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [screen, setScreen] = useState<Screen>('START');
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(CATEGORIES[0]);
  const [gameWord, setGameWord] = useState<GameItem | null>(null);
  const [impostorIds, setImpostorIds] = useState<string[]>([]);
  const [impostorCount, setImpostorCount] = useState(1);
  const [settings, setSettings] = useState<GameSettings>({
    impostorsKnowEachOther: true,
    revealSubCategory: true,
    giveImpostorClue: true,
  });
  
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);

  // --- LÓGICA DE TIEMPO REAL ---
  useEffect(() => {
    if (mode !== 'ONLINE' || !roomCode) return;

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
        const data = payload.new;
        setPlayers(data.players || []);
        setScreen(data.game_state as Screen);
        setGameWord(data.game_word);
        setImpostorIds(data.impostor_ids || []);
        setSettings(data.settings);
        setImpostorCount(data.impostor_ids?.length || 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mode, roomCode]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const createRoom = async () => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const code = generateCode();
    const myId = Math.random().toString(36).substr(2, 9);
    const me = { id: myId, name: currentPlayerName };
    
    const { error } = await supabase.from('rooms').insert([{
      code,
      players: [me],
      game_state: 'LOBBY',
      settings
    }]);

    if (error) return alert('Error: ' + error.message);
    setRoomCode(code);
    setPlayerId(myId);
    setPlayers([me]);
    setIsHost(true);
    setMode('ONLINE');
    setScreen('LOBBY');
  };

  const joinRoom = async (code: string) => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const cleanCode = code.toUpperCase();
    const { data, error } = await supabase.from('rooms').select('*').eq('code', cleanCode).single();
    if (error || !data) return alert('No se encontró la sala');

    const myId = Math.random().toString(36).substr(2, 9);
    const me = { id: myId, name: currentPlayerName };
    const updatedPlayers = [...(data.players || []), me];
    await supabase.from('rooms').update({ players: updatedPlayers }).eq('code', cleanCode);

    setRoomCode(cleanCode);
    setPlayerId(myId);
    setPlayers(updatedPlayers);
    setIsHost(false);
    setMode('ONLINE');
    setScreen('LOBBY');
  };

  const addLocalPlayer = () => {
    if (currentPlayerName.trim()) {
      setPlayers([...players, { id: Math.random().toString(36).substr(2, 9), name: currentPlayerName }]);
      setCurrentPlayerName('');
    }
  };

  const startLocalGame = () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    const word = selectedCategory.items[Math.floor(Math.random() * selectedCategory.items.length)];
    const imps = [...players].sort(() => Math.random() - 0.5).slice(0, impostorCount).map(p => p.id);
    setGameWord(word);
    setImpostorIds(imps);
    setRevealedIdx(0);
    setScreen('REVEAL');
  };

  const startOnlineGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    const word = selectedCategory.items[Math.floor(Math.random() * selectedCategory.items.length)];
    const imps = [...players].sort(() => Math.random() - 0.5).slice(0, impostorCount).map(p => p.id);
    await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, impostor_ids: imps, settings }).eq('code', roomCode);
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR<br/>PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.1 - Modo Local Corregido</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" style={{ marginBottom: '20px' }} />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: Math.random().toString(36).substr(2, 9), name:currentPlayerName}]); setCurrentPlayerName(''); setScreen('LOBBY'); setIsHost(true); }}>
              <User size={20} /> Modo Local (Un solo celu)
            </button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Modo Online</h4>
              <button className="btn btn-accent" onClick={createRoom} style={{ marginBottom: '10px' }}>Crear Sala</button>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input className="input" placeholder="Código" maxLength={4} style={{ marginBottom: 0, textTransform: 'uppercase' }} onChange={(e) => setRoomCode(e.target.value)} />
                <button className="btn btn-primary" onClick={() => joinRoom(roomCode)} style={{ width: 'auto', marginBottom: 0 }}><LogIn size={18} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === 'LOBBY' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>{mode === 'ONLINE' ? `CÓDIGO: ${roomCode}` : 'MODO LOCAL'}</h3>
              <button className="btn btn-secondary" onClick={() => { setPlayers([]); setScreen('START'); }} style={{ width: 'auto', padding: '5px 10px', marginBottom: 0 }}><ArrowLeft size={16}/></button>
            </div>
            {mode === 'LOCAL' && (
              <div style={{ marginBottom: '15px' }}>
                <label>Agregar Amigos:</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" onKeyDown={(e) => e.key === 'Enter' && addLocalPlayer()} />
                  <button className="btn btn-primary" onClick={addLocalPlayer} style={{ width: 'auto' }}><UserPlus size={18}/></button>
                </div>
              </div>
            )}
            <label>Jugadores ({players.length}):</label>
            <div className="grid" style={{ marginBottom: '15px' }}>
              {players.map(p => (
                <div key={p.id} className="btn btn-secondary" style={{ fontSize: '0.7rem', position: 'relative' }}>
                  {p.name}
                  {mode === 'LOCAL' && players.length > 1 && (
                    <span onClick={() => setPlayers(players.filter(pl => pl.id !== p.id))} style={{ position: 'absolute', right: '5px', top: '2px', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }}>×</span>
                  )}
                </div>
              ))}
            </div>
            {isHost && (
              <>
                <div style={{ margin: '15px 0' }}>
                  <label>Categoría:</label>
                  <select className="input" onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label>Impostores: {impostorCount}</label>
                  <div className="grid">
                    {[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{ marginBottom: 0 }}>{n}</button>)}
                  </div>
                </div>
                <button className="btn btn-accent" onClick={mode === 'LOCAL' ? startLocalGame : startOnlineGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            ) : (
              <p style={{ textAlign: 'center', color: '#666' }}>Esperando al anfitrión...</p>
            )}
          </div>
        )}

        {(screen === 'REVEAL' || screen === 'VOTING' || screen === 'RESULT') && (
          <GamePhase 
            screen={screen} setScreen={setScreen} mode={mode} 
            players={players} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx}
            gameWord={gameWord} impostorIds={impostorIds} settings={settings} 
            roomCode={roomCode} isHost={isHost}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GamePhase({ screen, setScreen, mode, players, playerId, revealedIdx, setRevealedIdx, gameWord, impostorIds, settings, roomCode, isHost }: any) {
  const [show, setShow] = useState(false);
  const currentPlayer = mode === 'LOCAL' ? players[revealedIdx] : players.find((p: any) => p.id === playerId);
  const isImpostor = impostorIds.includes(currentPlayer?.id);

  if (screen === 'REVEAL') {
    return (
      <div className="card">
        <h3>{currentPlayer?.name}, mirá tu secreto</h3>
        <div className="role-reveal" onClick={() => setShow(!show)}>
          {!show ? 'TAP PARA VER' : (
            <div>
              {isImpostor ? (
                <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR<br/><small style={{color: '#333'}}>Pista: {gameWord?.clue}</small></div>
              ) : (
                <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}<br/><small style={{color: '#666'}}>({gameWord?.sub})</small></div>
              )}
            </div>
          )}
        </div>
        {show && (
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={async () => {
            setShow(false);
            if (mode === 'LOCAL') {
              if (revealedIdx < players.length - 1) setRevealedIdx(revealedIdx + 1);
              else setScreen('VOTING');
            } else {
              if (isHost) await supabase.from('rooms').update({ game_state: 'VOTING' }).eq('code', roomCode);
            }
          }}>LISTO</button>
        )}
      </div>
    );
  }

  if (screen === 'VOTING') {
    return (
      <div className="card">
        <h3>¿Quién es el infiltrado?</h3>
        <div className="grid">
          {players.map((p: any) => <button key={p.id} className="btn btn-secondary" onClick={async () => {
            if (mode === 'LOCAL') setScreen('RESULT');
            else if (isHost) await supabase.from('rooms').update({ game_state: 'RESULT' }).eq('code', roomCode);
          }}>{p.name}</button>)}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={48} color="var(--oro)" style={{ margin: '0 auto 10px' }} />
      <h2>RESULTADO</h2>
      <p>Palabra: <strong>{gameWord?.name}</strong></p>
      <p>Infiltrados: <strong>{impostorIds.map((id: any) => players.find((p: any) => p.id === id)?.name).join(', ')}</strong></p>
      <button className="btn btn-primary" onClick={async () => {
        if (mode === 'LOCAL') { setScreen('LOBBY'); }
        else if (isHost) await supabase.from('rooms').update({ game_state: 'LOBBY' }).eq('code', roomCode);
      }}>OTRA PARTIDA</button>
    </div>
  );
}
