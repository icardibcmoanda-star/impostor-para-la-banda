import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft, Clock, Send, MessageSquare } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type Screen = 'START' | 'LOBBY' | 'INPUT_CUSTOM' | 'REVEAL' | 'WRITING' | 'DEBATE' | 'VOTING' | 'RESULT';

interface Player {
  id: string;
  name: string;
}

interface GameSettings {
  impostorsKnowEachOther: boolean;
  revealSubCategory: boolean;
  giveImpostorClue: boolean;
  useTimer: boolean;
  writtenClues: boolean;
}

interface TurnInfo {
  starter: string | null;
  direction: 'Horario' | 'Anti-horario';
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
    useTimer: true,
    writtenClues: false
  });
  
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [turnInfo, setTurnInfo] = useState<TurnInfo>({ starter: null, direction: 'Horario' });
  const [playerClues, setPlayerClues] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);

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
        setTurnInfo(data.turn_info);
        setPlayerClues(data.player_clues || {});
        setChatMessages(data.chat_messages || []);
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
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';
    
    setGameWord(word);
    setImpostorIds(imps);
    setTurnInfo({ starter, direction });
    setRevealedIdx(0);
    setScreen('REVEAL');
  };

  const startOnlineGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    const word = selectedCategory.items[Math.floor(Math.random() * selectedCategory.items.length)];
    const imps = [...players].sort(() => Math.random() - 0.5).slice(0, impostorCount).map(p => p.id);
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';

    await supabase.from('rooms').update({ 
      game_state: 'REVEAL', 
      game_word: word, 
      impostor_ids: imps, 
      settings,
      turn_info: { starter, direction }
    }).eq('code', roomCode);
  };

  const submitClue = async (clue: string) => {
    const newClues = { ...playerClues, [playerId]: clue };
    await supabase.from('rooms').update({ player_clues: newClues }).eq('code', roomCode);
    if (Object.keys(newClues).length === players.length) {
      await supabase.from('rooms').update({ game_state: 'DEBATE' }).eq('code', roomCode);
    }
  };

  const sendChatMessage = async (text: string) => {
    const newMessage = { sender: players.find(p => p.id === playerId)?.name, text, time: new Date().toLocaleTimeString() };
    const newHistory = [...chatMessages, newMessage];
    await supabase.from('rooms').update({ chat_messages: newHistory }).eq('code', roomCode);
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR<br/>PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.3 - Turnos & Debate</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" style={{ marginBottom: '20px' }} />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: Math.random().toString(36).substr(2, 9), name:currentPlayerName}]); setCurrentPlayerName(''); setScreen('LOBBY'); setIsHost(true); }}>
              <User size={20} /> Modo Local
            </button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4>Modo Online</h4>
              <button className="btn btn-accent" onClick={createRoom} style={{ marginBottom: '10px' }}>Crear Sala</button>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input className="input" placeholder="Código" maxLength={4} style={{ marginBottom: 0, textTransform: 'uppercase' }} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
                <button className="btn btn-primary" onClick={() => joinRoom(roomCode)} style={{ width: 'auto', marginBottom: 0 }}><LogIn size={18} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === 'LOBBY' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>{mode === 'ONLINE' ? `SALA: ${roomCode}` : 'LOCAL'}</h3>
              <button className="btn btn-secondary" onClick={() => { setPlayers([]); setScreen('START'); }} style={{ width: 'auto', padding: '5px 10px', marginBottom: 0 }}><ArrowLeft size={16}/></button>
            </div>
            {mode === 'LOCAL' && (
              <div style={{ marginBottom: '15px' }}>
                <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" onKeyDown={(e) => e.key === 'Enter' && addLocalPlayer()} />
                <button className="btn btn-primary" onClick={addLocalPlayer}>Sumar a la banda</button>
              </div>
            )}
            <label>La Banda ({players.length}):</label>
            <div className="grid" style={{ marginBottom: '15px' }}>
              {players.map(p => <div key={p.id} className="btn btn-secondary" style={{ fontSize: '0.7rem' }}>{p.name}</div>)}
            </div>
            {isHost && (
              <>
                <select className="input" onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ marginBottom: '15px' }}>
                  <label>Impostores: {impostorCount}</label>
                  <div className="grid">
                    {[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{ marginBottom: 0 }}>{n}</button>)}
                  </div>
                </div>
                <div className="card" style={{ background: '#f9f9f9', padding: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}><Settings size={16} /> Reglas</h4>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '10px' }}>
                    Cronómetro (30s)
                    <button onClick={() => setSettings({...settings, useTimer: !settings.useTimer})} className={`btn ${settings.useTimer ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '40px', padding: '5px', marginBottom: 0 }}>{settings.useTimer ? 'SI' : 'NO'}</button>
                  </label>
                  {mode === 'ONLINE' && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      Debate Escrito
                      <button onClick={() => setSettings({...settings, writtenClues: !settings.writtenClues})} className={`btn ${settings.writtenClues ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '40px', padding: '5px', marginBottom: 0 }}>{settings.writtenClues ? 'SI' : 'NO'}</button>
                    </label>
                  )}
                </div>
                <button className="btn btn-accent" onClick={mode === 'LOCAL' ? startLocalGame : startOnlineGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            )}
          </div>
        )}

        {(screen !== 'START' && screen !== 'LOBBY') && (
          <GamePhase 
            screen={screen} setScreen={setScreen} mode={mode} 
            players={players} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx}
            gameWord={gameWord} impostorIds={impostorIds} settings={settings} 
            roomCode={roomCode} isHost={isHost} turnInfo={turnInfo}
            playerClues={playerClues} submitClue={submitClue}
            chatMessages={chatMessages} sendChatMessage={sendChatMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GamePhase({ screen, setScreen, mode, players, playerId, revealedIdx, setRevealedIdx, gameWord, impostorIds, settings, roomCode, isHost, turnInfo, playerClues, submitClue, chatMessages, sendChatMessage }: any) {
  const [show, setShow] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [writtenClue, setWrittenClue] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentPlayer = mode === 'LOCAL' ? players[revealedIdx] : players.find((p: any) => p.id === playerId);
  const isImpostor = impostorIds.includes(currentPlayer?.id);

  // Timer logic
  useEffect(() => {
    if (screen === 'REVEAL' && show && settings.useTimer) {
      const timer = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
      return () => clearInterval(timer);
    }
  }, [show, screen]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (screen === 'REVEAL') {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <span className="btn btn-accent" style={{ width: 'auto' }}>Arranca: {turnInfo.starter}</span>
          <br/>
          <small>Sentido: {turnInfo.direction}</small>
        </div>
        <h3>{currentPlayer?.name}, tu secreto</h3>
        <div className="role-reveal" onClick={() => setShow(!show)}>
          {!show ? 'TAP PARA VER' : (
            <div>
              {isImpostor ? (
                <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR<br/><small>Pista: {gameWord?.clue}</small></div>
              ) : (
                <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}<br/><small>({gameWord?.sub})</small></div>
              )}
              {settings.useTimer && (
                <div style={{ marginTop: '10px', fontSize: '1.5rem', fontWeight: 'bold', color: timeLeft < 10 ? 'red' : 'black' }}>
                  <Clock size={20} /> {timeLeft}s
                </div>
              )}
            </div>
          )}
        </div>
        {show && (
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={async () => {
            setShow(false);
            setTimeLeft(30);
            if (mode === 'LOCAL') {
              if (revealedIdx < players.length - 1) setRevealedIdx(revealedIdx + 1);
              else setScreen(settings.writtenClues ? 'WRITING' : 'VOTING');
            } else {
              if (isHost) await supabase.from('rooms').update({ game_state: settings.writtenClues ? 'WRITING' : 'VOTING' }).eq('code', roomCode);
            }
          }}>LISTO</button>
        )}
      </div>
    );
  }

  if (screen === 'WRITING') {
    const alreadySubmitted = !!playerClues[playerId];
    return (
      <div className="card">
        <h3>Modo Escritura</h3>
        <p>Escribí tu pista para los demás (sin decir la palabra):</p>
        <input className="input" value={writtenClue} onChange={(e) => setWrittenClue(e.target.value)} disabled={alreadySubmitted} placeholder="Ej: Es de cuero..." />
        <button className="btn btn-accent" onClick={() => submitClue(writtenClue)} disabled={alreadySubmitted || !writtenClue}>
          {alreadySubmitted ? 'Esperando al resto...' : 'Enviar Pista'}
        </button>
      </div>
    );
  }

  if (screen === 'DEBATE') {
    return (
      <div className="card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3>Debate de la Banda</h3>
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f0f0', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
          {chatMessages.map((m: any, i: number) => (
            <div key={i} style={{ marginBottom: '10px', background: 'white', padding: '8px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <strong>{m.sender}:</strong> {m.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <input className="input" style={{ marginBottom: 0 }} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribí acá..." onKeyDown={(e) => e.key === 'Enter' && (sendChatMessage(chatInput), setChatInput(''))} />
          <button className="btn btn-primary" style={{ width: 'auto', marginBottom: 0 }} onClick={() => { sendChatMessage(chatInput); setChatInput(''); }}><Send size={18}/></button>
        </div>
        {isHost && <button className="btn btn-accent" style={{ marginTop: '10px' }} onClick={async () => await supabase.from('rooms').update({ game_state: 'VOTING' }).eq('code', roomCode)}>IR A VOTAR</button>}
      </div>
    );
  }

  if (screen === 'VOTING') {
    return (
      <div className="card">
        <h3>¿Quién es el infiltrado?</h3>
        {settings.writtenClues && (
          <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '10px', marginBottom: '15px', fontSize: '0.8rem' }}>
            <strong>Pistas dadas:</strong>
            {Object.entries(playerClues).map(([pid, clue]: any) => (
              <div key={pid}>• {players.find((p: any) => p.id === pid)?.name}: {clue}</div>
            ))}
          </div>
        )}
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
      <Trophy size={48} color="var(--oro)" />
      <h2>RESULTADO</h2>
      <p>Palabra: <strong>{gameWord?.name}</strong></p>
      <p>Infiltrados: <strong>{impostorIds.map((id: any) => players.find((p: any) => p.id === id)?.name).join(', ')}</strong></p>
      <button className="btn btn-primary" onClick={async () => {
        if (mode === 'LOCAL') { setScreen('LOBBY'); }
        else if (isHost) await supabase.from('rooms').update({ game_state: 'LOBBY', player_clues: {}, chat_messages: [] }).eq('code', roomCode);
      }}>OTRA PARTIDA</button>
    </div>
  );
}
