import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft, Clock, Send, MessageSquare, PenTool, FastForward, ChevronRight } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type Screen = 'START' | 'LOBBY' | 'REVEAL' | 'WRITING' | 'DEBATE' | 'VOTING' | 'RESULT';

interface GameSettings {
  impostorsKnowEachOther: boolean;
  revealSubCategory: boolean;
  giveImpostorClue: boolean;
  useTimer: boolean;
  writtenClues: boolean;
}

export default function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [screen, setScreen] = useState<Screen>('START');
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(CATEGORIES[0]);
  const [gameWord, setGameWord] = useState<GameItem | null>(null);
  const [impostorCount, setImpostorCount] = useState(1);
  const [settings, setSettings] = useState<GameSettings>({
    impostorsKnowEachOther: true,
    revealSubCategory: true,
    giveImpostorClue: true,
    useTimer: true,
    writtenClues: true
  });
  
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [turnInfo, setTurnInfo] = useState<any>({ starter: null, direction: 'Horario' });

  // --- SINCRONIZACIÓN ONLINE ---
  useEffect(() => {
    if (mode !== 'ONLINE' || !roomCode) return;

    const roomSub = supabase.channel(`room-${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
        const data = payload.new;
        setScreen(data.game_state);
        setGameWord(data.game_word);
        setSettings(data.settings);
        setTurnInfo(data.turn_info);
      }).subscribe();

    const playersSub = supabase.channel(`players-${roomCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` }, async () => {
        const { data } = await supabase.from('players').select('*').eq('room_code', roomCode).order('created_at');
        if (data) setPlayers(data);
      }).subscribe();

    return () => { supabase.removeChannel(roomSub); supabase.removeChannel(playersSub); };
  }, [mode, roomCode]);

  const createRoom = async () => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    const myId = Math.random().toString(36).substr(2, 9);
    await supabase.from('rooms').insert([{ code, settings, game_state: 'LOBBY' }]);
    await supabase.from('players').insert([{ id: myId, room_code: code, name: currentPlayerName, is_host: true }]);
    setRoomCode(code); setPlayerId(myId); setIsHost(true); setMode('ONLINE'); setScreen('LOBBY');
  };

  const joinRoom = async (code: string) => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const myId = Math.random().toString(36).substr(2, 9);
    const { error } = await supabase.from('players').insert([{ id: myId, room_code: code.toUpperCase(), name: currentPlayerName }]);
    if (error) return alert('No se encontró la sala');
    setRoomCode(code.toUpperCase()); setPlayerId(myId); setIsHost(false); setMode('ONLINE'); setScreen('LOBBY');
  };

  const startOnlineGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    const word = selectedCategory.items[Math.floor(Math.random() * selectedCategory.items.length)];
    
    // Mezclado real
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const imps = shuffled.slice(0, impostorCount).map(p => p.id);
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';

    for (const p of players) {
      await supabase.from('players').update({ is_ready: false, is_impostor: imps.includes(p.id), clue: '' }).eq('id', p.id);
    }
    await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, turn_info: { starter, direction }, settings }).eq('code', roomCode);
  };

  const startLocalGame = () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    const word = selectedCategory.items[Math.floor(Math.random() * selectedCategory.items.length)];
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const imps = shuffled.slice(0, impostorCount).map(p => p.id);
    const starter = players[Math.floor(Math.random() * players.length)].name;
    const direction = Math.random() > 0.5 ? 'Horario' : 'Anti-horario';
    
    setGameWord(word);
    setPlayers(players.map(p => ({ ...p, is_impostor: imps.includes(p.id), is_ready: false, clue: '' })));
    setTurnInfo({ starter, direction });
    setRevealedIdx(0);
    setScreen('REVEAL');
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR<br/>PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.6.0 - Edición Completa</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" style={{ marginBottom: '20px' }} />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: '1', name:currentPlayerName}]); setScreen('LOBBY'); setIsHost(true); }}>
              <User size={20} /> Modo Local (Un solo celu)
            </button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4>Modo Online (Varios celus)</h4>
              <button className="btn btn-accent" onClick={createRoom} style={{ marginBottom: '10px' }}>Crear Sala</button>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input className="input" placeholder="Código" maxLength={4} style={{ marginBottom: 0, textTransform: 'uppercase' }} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
                <button className="btn btn-primary" onClick={() => joinRoom(roomCode)}><LogIn size={18} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === 'LOBBY' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{mode === 'ONLINE' ? `SALA: ${roomCode}` : 'LOCAL'}</h3>
              <button className="btn btn-secondary" onClick={() => { setPlayers([]); setScreen('START'); }} style={{ width: 'auto', padding: '5px' }}><ArrowLeft size={16}/></button>
            </div>
            {mode === 'LOCAL' && (
              <div style={{ margin: '15px 0' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" />
                  <button className="btn btn-primary" onClick={() => { setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}]); setCurrentPlayerName(''); }} style={{ width: 'auto' }}><UserPlus size={18}/></button>
                </div>
              </div>
            )}
            <div className="grid" style={{ margin: '15px 0' }}>
              {players.map(p => <div key={p.id} className={`btn ${p.id === playerId ? 'btn-accent' : 'btn-secondary'}`} style={{ fontSize: '0.7rem' }}>{p.name} {p.is_host && '👑'}</div>)}
            </div>
            {isHost && (
              <>
                <select className="input" onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ marginBottom: '15px' }}><label>Impostores: {impostorCount}</label>
                  <div className="grid">{[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{marginBottom: 0}}>{n}</button>)}</div>
                </div>
                <div className="card" style={{ background: '#f9f9f9', padding: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}><Settings size={16} /> Reglas Extra</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <ToggleButton label="Cronómetro" value={settings.useTimer} onClick={() => setSettings({...settings, useTimer: !settings.useTimer})} />
                    <ToggleButton label="Debate Escrito" value={settings.writtenClues} onClick={() => setSettings({...settings, writtenClues: !settings.writtenClues})} />
                    <ToggleButton label="Ver Sub-categoría" value={settings.revealSubCategory} onClick={() => setSettings({...settings, revealSubCategory: !settings.revealSubCategory})} />
                    <ToggleButton label="Pista de Gemini" value={settings.giveImpostorClue} onClick={() => setSettings({...settings, giveImpostorClue: !settings.giveImpostorClue})} />
                    <ToggleButton label="Impostores se conocen" value={settings.impostorsKnowEachOther} onClick={() => setSettings({...settings, impostorsKnowEachOther: !settings.impostorsKnowEachOther})} />
                  </div>
                </div>
                <button className="btn btn-accent" onClick={mode === 'LOCAL' ? startLocalGame : startOnlineGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            )}
            {!isHost && <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>Esperando al anfitrión...</p>}
          </div>
        )}

        {(screen !== 'START' && screen !== 'LOBBY') && (
          <GamePhase 
            screen={screen} setScreen={setScreen} mode={mode} 
            players={players} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx}
            gameWord={gameWord} settings={settings} roomCode={roomCode} isHost={isHost} turnInfo={turnInfo}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleButton({ label, value, onClick }: any) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center', marginBottom: '5px' }}>
      {label} <button onClick={onClick} className={`btn ${value ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '40px', padding: '5px', marginBottom: 0 }}>{value ? <Check size={14}/> : <X size={14}/>}</button>
    </label>
  );
}

function GamePhase({ screen, setScreen, mode, players, playerId, revealedIdx, setRevealedIdx, gameWord, settings, roomCode, isHost, turnInfo }: any) {
  const [show, setShow] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [clueInput, setClueInput] = useState('');
  const [votedId, setVotedId] = useState('');
  
  const me = mode === 'LOCAL' ? players[revealedIdx] : players.find((p: any) => p.id === playerId) || players[0];
  const isImpostor = me?.is_impostor;
  const otherImpostors = players.filter((p:any) => p.is_impostor && p.id !== me.id);

  useEffect(() => {
    if (screen === 'REVEAL' && show && settings.useTimer && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [show, screen, timeLeft]);

  const handleNextStage = async (next: Screen) => {
    if (mode === 'LOCAL') setScreen(next);
    else await supabase.from('rooms').update({ game_state: next }).eq('code', roomCode);
  };

  if (screen === 'REVEAL') {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}><span className="btn btn-accent" style={{ width: 'auto' }}>Arranca: {turnInfo?.starter} ({turnInfo?.direction})</span></div>
        <h3>{me?.name}, tu secreto</h3>
        <div className="role-reveal" onClick={() => setShow(!show)}>
          {!show ? 'TAP PARA VER' : (
            <div>
              {isImpostor ? (
                <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR PARA LA BANDA
                  {settings.revealSubCategory && <p style={{color: '#333'}}>Tipo: {gameWord?.sub}</p>}
                  {settings.impostorsKnowEachOther && otherImpostors.length > 0 && <p style={{fontSize: '0.7rem', color: '#666'}}>Cómplices: {otherImpostors.map((p: any) => p.name).join(', ')}</p>}
                  {settings.giveImpostorClue && <p style={{fontSize: '0.9rem', color: '#333'}}>💡 Pista: {gameWord?.clue}</p>}
                </div>
              ) : (
                <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}
                  {settings.revealSubCategory && <p style={{fontSize: '0.8rem', color: '#666'}}>({gameWord?.sub})</p>}
                </div>
              )}
              {settings.useTimer && <div style={{ marginTop: '10px', fontSize: '1.2rem' }}><Clock size={16}/> {timeLeft}s</div>}
            </div>
          )}
        </div>
        {show && (
          <div style={{ marginTop: '20px' }}>
            {mode === 'LOCAL' ? (
              <button className="btn btn-primary" onClick={() => { setShow(false); setTimeLeft(30); if (revealedIdx < players.length - 1) setRevealedIdx(revealedIdx + 1); else setScreen(settings.writtenClues ? 'WRITING' : 'DEBATE'); }}>SIGUIENTE</button>
            ) : (
              <>
                <button className={`btn ${me.is_ready ? 'btn-secondary' : 'btn-primary'}`} onClick={async () => await supabase.from('players').update({ is_ready: true }).eq('id', playerId)}>
                  {me.is_ready ? `LISTOS: ${players.filter((p:any)=>p.is_ready).length}/${players.length}` : 'YA LEÍ, ESTOY LISTO'}
                </button>
                {isHost && <button className="btn btn-accent" style={{marginTop:'15px', fontSize:'0.8rem'}} onClick={() => handleNextStage(settings.writtenClues ? 'WRITING' : 'DEBATE')}>AVANZAR A LA BANDA <FastForward size={16}/></button>}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (screen === 'WRITING') {
    return (
      <div className="card">
        <h3><PenTool size={20}/> Modo Escritura</h3>
        <p style={{fontSize:'0.8rem'}}>Escribí una pista sobre tu palabra.</p>
        <input className="input" value={clueInput} onChange={(e) => setClueInput(e.target.value)} placeholder="Tu pista..." disabled={mode === 'ONLINE' && !!me.clue} />
        <button className="btn btn-primary" onClick={async () => { if (mode === 'LOCAL') setScreen('DEBATE'); else await supabase.from('players').update({ clue: clueInput }).eq('id', playerId); }}>
          {mode === 'ONLINE' && me.clue ? 'Enviado ✅' : 'ENVIAR PISTA'}
        </button>
        {isHost && mode === 'ONLINE' && <button className="btn btn-accent" style={{marginTop:'15px'}} onClick={() => handleNextStage('DEBATE')}>IR AL DEBATE</button>}
      </div>
    );
  }

  if (screen === 'DEBATE') {
    return (
      <div className="card">
        <h3><MessageSquare size={20}/> Debate de la Banda</h3>
        {settings.writtenClues && (
          <div style={{background:'#f9f9f9', padding:'10px', borderRadius:'10px', margin:'10px 0'}}>
            {players.map((p:any) => <div key={p.id} style={{fontSize:'0.8rem', borderBottom:'1px solid #eee', padding:'5px 0'}}>• {p.name}: {p.clue || '...'}</div>)}
          </div>
        )}
        <p style={{textAlign:'center', fontSize:'0.8rem', marginTop:'10px'}}>Discutan y cuando estén listos voten.</p>
        {isHost && <button className="btn btn-accent" style={{marginTop:'20px'}} onClick={() => handleNextStage('VOTING')}>IR A VOTAR</button>}
      </div>
    );
  }

  if (screen === 'VOTING') {
    return (
      <div className="card">
        <h3>¿Quién es el infiltrado?</h3>
        <div className="grid">
          {players.map((p: any) => <button key={p.id} className={`btn ${votedId === p.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => isHost && setVotedId(p.id)}>{p.name}</button>)}
        </div>
        {isHost && votedId && (
          <button className="btn btn-accent" style={{marginTop:'20px'}} onClick={() => handleNextStage('RESULT')}>REVELAR A {players.find((p:any)=>p.id===votedId)?.name}</button>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={48} color="var(--oro)" />
      <h2>RESULTADO</h2>
      <p>La palabra era: <strong>{gameWord?.name}</strong></p>
      <p>Los Impostores eran:</p>
      <div className="grid">{players.filter((p:any) => p.is_impostor).map((p:any) => <div key={p.id} className="btn btn-accent">{p.name}</div>)}</div>
      {isHost && <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={() => handleNextStage('LOBBY')}>OTRA PARTIDA</button>}
    </div>
  );
}
