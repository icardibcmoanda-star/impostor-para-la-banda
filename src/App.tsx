import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, UserPlus, Info, Trophy, Ghost, User, Settings, Check, X, LogIn, ArrowLeft, Clock, Send, CheckCircle2, FastForward, ChevronRight, MessageSquare, PenTool, Skull } from 'lucide-react';
import { CATEGORIES, Category, GameItem } from './data/categories';
import { supabase } from './supabase';

type GameMode = 'LOCAL' | 'ONLINE';
type Screen = 'START' | 'LOBBY' | 'INPUT_CUSTOM' | 'REVEAL' | 'WRITING' | 'DEBATE' | 'VOTING' | 'VOTE_RESULT' | 'RESULT';

interface GameSettings {
  impostorsKnowEachOther: boolean; revealSubCategory: boolean; giveImpostorClue: boolean; useTimer: boolean; writtenClues: boolean;
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
  const [settings, setSettings] = useState<GameSettings>({ impostorsKnowEachOther: true, revealSubCategory: true, giveImpostorClue: true, useTimer: true, writtenClues: true });
  const [isHost, setIsHost] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [turnInfo, setTurnInfo] = useState<any>({ starter: null, direction: 'Horario', chat: [], votes: {}, eliminated: [], round: 1, winner: null });

  // --- SINCRONIZACIÓN ---
  useEffect(() => {
    if (mode !== 'ONLINE' || !roomCode) return;
    const roomSub = supabase.channel(`room-${roomCode}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, (payload) => {
      const data = payload.new;
      if (data.game_state) setScreen(data.game_state);
      if (data.game_word) setGameWord(data.game_word);
      if (data.settings) setSettings(data.settings);
      if (data.turn_info) setTurnInfo(data.turn_info);
    }).subscribe();
    const playersSub = supabase.channel(`players-${roomCode}`).on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` }, async () => {
      const { data } = await supabase.from('players').select('*').eq('room_code', roomCode).order('created_at');
      if (data) setPlayers(data);
    }).subscribe();
    return () => { supabase.removeChannel(roomSub); supabase.removeChannel(playersSub); };
  }, [mode, roomCode]);

  const createRoom = async () => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const code = Math.random().toString(36).substr(2, 4).toUpperCase();
    const myId = Math.random().toString(36).substr(2, 9);
    const initialTurnInfo = { starter: null, direction: 'Horario', chat: [], votes: {}, eliminated: [], round: 1, winner: null };
    await supabase.from('rooms').insert([{ code, settings, game_state: 'LOBBY', turn_info: initialTurnInfo }]);
    await supabase.from('players').insert([{ id: myId, room_code: code, name: currentPlayerName, is_host: true }]);
    setRoomCode(code); setPlayerId(myId); setIsHost(true); setMode('ONLINE'); setScreen('LOBBY');
  };

  const joinRoom = async (code: string) => {
    if (!currentPlayerName.trim()) return alert('Poné tu nombre');
    const myId = Math.random().toString(36).substr(2, 9);
    const cleanCode = code.toUpperCase();
    const { error } = await supabase.from('players').insert([{ id: myId, room_code: cleanCode, name: currentPlayerName }]);
    if (error) return alert('No existe la sala');
    setRoomCode(cleanCode); setPlayerId(myId); setIsHost(false); setMode('ONLINE'); setScreen('LOBBY');
  };

  const getRandomWord = (items: any[], catId: string) => {
    const usedKey = 'used_' + catId;
    let used = JSON.parse(localStorage.getItem(usedKey) || '[]');
    let available = items.filter(i => !used.includes(i.name || i));
    if (available.length === 0) { used = []; available = items; }
    const selected = available[Math.floor(Math.random() * available.length)];
    used.push(selected.name || selected);
    localStorage.setItem(usedKey, JSON.stringify(used));
    return typeof selected === 'string' ? { name: selected, sub: 'Amigo', clue: 'Alguien conocido' } : selected;
  };

  const startGame = async () => {
    if (players.length < 3) return alert('Mínimo 3 jugadores');
    if (mode === 'LOCAL') {
      if (selectedCategory.isCustom) { setScreen('INPUT_CUSTOM'); setRevealedIdx(0); return; }
      const word = getRandomWord(selectedCategory.items, selectedCategory.id);
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const imps = shuffled.slice(0, impostorCount).map(p => p.id);
      setGameWord(word); setPlayers(players.map(p => ({ ...p, is_impostor: imps.includes(p.id), is_ready: false, clue: '', custom_names: [] })));
      setTurnInfo({ starter: players[Math.floor(Math.random()*players.length)].name, direction: Math.random() > 0.5 ? 'Horario' : 'Anti-horario', chat: [], votes: {}, eliminated: [], round: 1, winner: null });
      setRevealedIdx(0); setScreen('REVEAL');
    } else {
      if (selectedCategory.isCustom) { await supabase.from('rooms').update({ game_state: 'INPUT_CUSTOM', turn_info: { ...turnInfo, eliminated: [], round: 1, chat: [], votes: {}, winner: null } }).eq('code', roomCode); return; }
      const word = getRandomWord(selectedCategory.items, selectedCategory.id);
      const shuffled = [...players];
      for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
      const imps = shuffled.slice(0, impostorCount).map(p => p.id);
      for (const p of players) await supabase.from('players').update({ is_ready: false, is_impostor: imps.includes(p.id), clue: '', custom_names: [] }).eq('id', p.id);
      await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, turn_info: { starter: players[Math.floor(Math.random()*players.length)].name, direction: Math.random() > 0.5 ? 'Horario' : 'Anti-horario', chat: [], votes: {}, eliminated: [], round: 1, winner: null }, settings }).eq('code', roomCode);
    }
  };

  return (
    <div className="screen">
      <h1 className="title" style={{ fontSize: '1.8rem' }}>IMPOSTOR PARA LA BANDA 🇦🇷</h1>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#aaa', marginTop: '-15px', marginBottom: '10px' }}>v1.8.3 - Conocidos & Local FIX</p>
      
      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Tu nombre" />
            <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return alert('Poné tu nombre'); setMode('LOCAL'); setPlayers([{id: '1', name:currentPlayerName}]); setPlayerId('1'); setCurrentPlayerName(''); setScreen('LOBBY'); setIsHost(true); }}><User size={20} /> Modo Local</button>
            <div className="card" style={{ background: '#f0f4f8', padding: '15px', marginTop: '15px' }}>
              <h4>Modo Online</h4>
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
                  <input className="input" value={currentPlayerName} onChange={(e) => setCurrentPlayerName(e.target.value)} placeholder="Nombre del amigo" onKeyDown={(e) => e.key === 'Enter' && setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}])} />
                  <button className="btn btn-primary" onClick={() => { if (!currentPlayerName.trim()) return; setPlayers([...players, {id: Math.random().toString(), name: currentPlayerName}]); setCurrentPlayerName(''); }} style={{ width: 'auto' }}><UserPlus size={18}/></button>
                </div>
              </div>
            )}
            <div className="grid">
              {players.map(p => (
                <div key={p.id} className={`btn ${p.id === playerId ? 'btn-accent' : 'btn-secondary'}`} style={{ fontSize: '0.7rem', position:'relative' }}>
                  {p.name} {p.is_host && '👑'}
                  {mode === 'LOCAL' && players.length > 1 && <X size={14} onClick={() => setPlayers(players.filter(pl => pl.id !== p.id))} style={{position:'absolute', right:'5px', color:'red'}} />}
                </div>
              ))}
            </div>
            {isHost && (
              <>
                <select className="input" style={{marginTop:'15px'}} onChange={(e) => setSelectedCategory(CATEGORIES.find(c => c.id === e.target.value)!)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ marginBottom: '15px' }}><label>Impostores: {impostorCount}</label>
                  <div className="grid">{[1, 2, 3, 4, 5, 6].map(n => <button key={n} className={`btn ${impostorCount === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImpostorCount(n)} disabled={n >= players.length - 1} style={{marginBottom: 0}}>{n}</button>)}</div>
                </div>
                <div className="card" style={{ background: '#f9f9f9', padding: '10px', marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}><Settings size={16} /> Reglas Extra</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <ToggleButton label="Cronómetro" value={settings.useTimer} onClick={() => setSettings({...settings, useTimer: !settings.useTimer})} />
                    <ToggleButton label="Pista Gemini" value={settings.giveImpostorClue} onClick={() => setSettings({...settings, giveImpostorClue: !settings.giveImpostorClue})} />
                    <ToggleButton label="Los impostores se conocen" value={settings.impostorsKnowEachOther} onClick={() => setSettings({...settings, impostorsKnowEachOther: !settings.impostorsKnowEachOther})} />
                    {mode === 'ONLINE' && <ToggleButton label="Debate Escrito" value={settings.writtenClues} onClick={() => setSettings({...settings, writtenClues: !settings.writtenClues})} />}
                  </div>
                </div>
                <button className="btn btn-accent" onClick={startGame} disabled={players.length < 3}>¡EMPEZAR!</button>
              </>
            )}
          </div>
        )}

        {(screen !== 'START' && screen !== 'LOBBY') && (
          <GamePhase screen={screen} setScreen={setScreen} mode={mode} players={players} setPlayers={setPlayers} playerId={playerId} revealedIdx={revealedIdx} setRevealedIdx={setRevealedIdx} gameWord={gameWord} setGameWord={setGameWord} settings={settings} roomCode={roomCode} isHost={isHost} turnInfo={turnInfo} setTurnInfo={setTurnInfo} getRandomWord={getRandomWord} impostorCount={impostorCount} selectedCategory={selectedCategory} />
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

function GamePhase({ screen, setScreen, mode, players, setPlayers, playerId, revealedIdx, setRevealedIdx, gameWord, setGameWord, settings, roomCode, isHost, turnInfo, setTurnInfo, getRandomWord, impostorCount, selectedCategory }: any) {
  const [show, setShow] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [clueInput, setClueInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [customNames, setCustomNames] = useState(['', '', '']);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const activePlayers = players.filter((p:any) => !(turnInfo?.eliminated || []).includes(p.id));
  const me = mode === 'LOCAL' ? activePlayers[revealedIdx] : players.find((p: any) => p.id === playerId) || players[0];
  const isEliminated = (turnInfo?.eliminated || []).includes(playerId);

  useEffect(() => { if (screen === 'REVEAL' && show && settings.useTimer && timeLeft > 0) { const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000); return () => clearInterval(timer); } }, [show, screen, timeLeft]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turnInfo?.chat]);

  const handleNextStage = async (next: Screen) => { if (mode === 'LOCAL') setScreen(next); else await supabase.from('rooms').update({ game_state: next }).eq('code', roomCode); };

  if (screen === 'INPUT_CUSTOM') {
    const handleCustomSubmit = async () => {
      if (customNames.some(n => !n.trim())) return alert('Completá los 3 nombres');
      if (mode === 'LOCAL') {
        const allWords = [...(players[revealedIdx].custom_names || []), ...customNames];
        setPlayers(players.map((p, i) => i === revealedIdx ? {...p, custom_names: customNames} : p));
        if (revealedIdx < players.length - 1) { setRevealedIdx(revealedIdx + 1); setCustomNames(['','','']); }
        else {
          const finalWords = players.map((p, i) => i === revealedIdx ? customNames : (p.custom_names || [])).flat();
          const word = getRandomWord(finalWords, 'conocidos');
          const shuffled = [...players].sort(() => Math.random() - 0.5);
          const imps = shuffled.slice(0, impostorCount).map(p => p.id);
          setGameWord(word); setPlayers(players.map((p, i) => ({ ...p, is_impostor: imps.includes(p.id), custom_names: i === revealedIdx ? customNames : p.custom_names })));
          setTurnInfo({...turnInfo, starter: players[0].name }); setRevealedIdx(0); setScreen('REVEAL');
        }
      } else {
        await supabase.from('players').update({ custom_names: customNames, is_ready: true }).eq('id', playerId);
      }
    };
    return (
      <div className="card">
        <h3>👥 Conocidos</h3>
        <p style={{fontSize:'0.8rem'}}>Escribí 3 nombres de gente conocida (Turno de {me?.name}).</p>
        {customNames.map((n, i) => <input key={i} className="input" value={n} onChange={(e) => { const next = [...customNames]; next[i] = e.target.value; setCustomNames(next); }} placeholder={`Nombre ${i + 1}`} disabled={mode === 'ONLINE' && me?.is_ready} />)}
        <button className="btn btn-primary" onClick={handleCustomSubmit} disabled={mode === 'ONLINE' && me?.is_ready}>{me?.is_ready ? 'ENVIADO ✅' : 'ENVIAR'}</button>
        {isHost && mode === 'ONLINE' && <button className="btn btn-accent" style={{marginTop:'10px'}} onClick={async () => {
          const { data } = await supabase.from('players').select('custom_names').eq('room_code', roomCode);
          const allWords = data?.flatMap(p => p.custom_names || []) || [];
          if (allWords.length === 0) return alert('Nadie mandó nombres');
          const word = getRandomWord(allWords, 'conocidos');
          const shuffled = [...players];
          for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
          const imps = shuffled.slice(0, impostorCount).map(p => p.id);
          for (const p of players) await supabase.from('players').update({ is_ready: false, is_impostor: imps.includes(p.id), clue: '' }).eq('id', p.id);
          await supabase.from('rooms').update({ game_state: 'REVEAL', game_word: word, turn_info: {...turnInfo, starter: players[0].name} }).eq('code', roomCode);
        }}>SORTEAR Y EMPEZAR</button>}
      </div>
    );
  }

  if (screen === 'REVEAL') {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}><span className="btn btn-accent" style={{ width: 'auto' }}>Ronda {turnInfo?.round || 1} - Arranca: {turnInfo?.starter}</span></div>
        <h3>{me?.name}, tu secreto</h3>
        <div className="role-reveal" onClick={() => setShow(!show)}>
          {!show ? 'TAP PARA VER' : (
            <div>
              {me?.is_impostor ? <div style={{ color: '#E74C3C' }}><Ghost size={48}/><br/>SOS EL IMPOSTOR<br/><small>Pista: {gameWord?.clue}</small></div> : <div style={{ color: 'var(--accent)' }}><Info size={48}/><br/>PALABRA: {gameWord?.name}</div>}
              {settings.useTimer && <div style={{ marginTop: '10px' }}><Clock size={16}/> {timeLeft}s</div>}
            </div>
          )}
        </div>
        {show && (
          <div style={{ marginTop: '20px' }}>
            {mode === 'LOCAL' ? <button className="btn btn-primary" onClick={() => { setShow(false); setTimeLeft(30); if (revealedIdx < activePlayers.length - 1) setRevealedIdx(revealedIdx + 1); else setScreen(settings.writtenClues ? 'WRITING' : 'DEBATE'); }}>SIGUIENTE</button> :
            <button className={`btn ${me?.is_ready ? 'btn-secondary' : 'btn-primary'}`} onClick={async () => await supabase.from('players').update({ is_ready: true }).eq('id', playerId)}>{me?.is_ready ? 'LISTO ✅' : 'YA LEÍ'}</button>}
            {isHost && mode === 'ONLINE' && (
              <div style={{marginTop:'15px', padding:'10px', background:'#eee', borderRadius:'10px'}}>
                <p style={{fontSize:'0.7rem', margin:0}}>Listos: {players.filter((p:any)=>p.is_ready).length} / {activePlayers.length}</p>
                <button className="btn btn-accent" style={{marginTop:'5px', fontSize:'0.8rem'}} onClick={() => handleNextStage(settings.writtenClues ? 'WRITING' : 'DEBATE')}>AVANZAR</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (screen === 'WRITING') {
    const cluesRecv = players.filter((p:any) => p.clue && !(turnInfo?.eliminated || []).includes(p.id)).length;
    return (
      <div className="card">
        <h3><PenTool size={20}/> Modo Escritura</h3>
        <input className="input" value={clueInput} onChange={(e) => setClueInput(e.target.value)} placeholder="Tu pista..." disabled={!!me?.clue || isEliminated} />
        <button className="btn btn-primary" onClick={async () => { if (mode === 'LOCAL') { setPlayers(players.map(p => p.id === me.id ? {...p, clue: clueInput} : p)); setRevealedIdx(revealedIdx + 1); if (revealedIdx >= activePlayers.length - 1) { setRevealedIdx(0); setScreen('DEBATE'); } setClueInput(''); } else await supabase.from('players').update({ clue: clueInput }).eq('id', playerId); }} disabled={!!me?.clue || isEliminated}>ENVIAR</button>
        {isHost && mode === 'ONLINE' && (
          <div style={{marginTop:'15px', padding:'10px', background:'#eee', borderRadius:'10px'}}>
            <p style={{fontSize:'0.7rem', margin:0}}>Pistas: {cluesRecv} / {activePlayers.length}</p>
            <button className="btn btn-accent" style={{marginTop:'5px', fontSize:'0.8rem'}} onClick={() => handleNextStage('DEBATE')}>IR AL DEBATE</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'DEBATE') {
    return (
      <div className="card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3><MessageSquare size={20}/> Debate</h3>
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f0f0', padding: '10px', borderRadius: '10px' }}>
          <div style={{background:'white', padding:'8px', borderRadius:'8px', marginBottom:'10px'}}>
            <strong>Pistas de esta ronda:</strong>
            {activePlayers.map((p:any) => <div key={p.id} style={{fontSize:'0.75rem'}}>• {p.name}: {p.clue || '...'}</div>)}
          </div>
          {(turnInfo?.chat || []).map((m: any, i: number) => <div key={i} style={{ background: 'white', padding: '5px', borderRadius: '5px', marginBottom: '5px' }}><strong>{m.sender}:</strong> {m.text}</div>)}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
          <input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{marginBottom: 0}} disabled={isEliminated} />
          <button className="btn btn-primary" onClick={async () => { if(!chatInput.trim())return; const newChat = [...(turnInfo?.chat || []), {sender: me.name, text: chatInput}]; if (mode === 'LOCAL') setTurnInfo({...turnInfo, chat: newChat}); else await supabase.from('rooms').update({ turn_info: {...turnInfo, chat: newChat} }).eq('code', roomCode); setChatInput(''); }} style={{width:'auto'}}><Send size={18}/></button>
        </div>
        {isHost && <button className="btn btn-accent" style={{marginTop:'10px'}} onClick={() => handleNextStage('VOTING')}>VOTAR</button>}
      </div>
    );
  }

  if (screen === 'VOTING') {
    const votesRecv = Object.keys(turnInfo?.votes || {}).length;
    return (
      <div className="card">
        <h3><CheckCircle2 size={20}/> Votación</h3>
        <div className="grid">
          {activePlayers.map((p: any) => <button key={p.id} className={`btn ${turnInfo?.votes?.[playerId] === p.id ? 'btn-primary' : 'btn-secondary'}`} onClick={async () => {
            const newVotes = { ...(turnInfo?.votes || {}), [playerId || 'local']: p.id };
            if (mode === 'LOCAL') setTurnInfo({...turnInfo, votes: newVotes}); else await supabase.from('rooms').update({ turn_info: {...turnInfo, votes: newVotes} }).eq('code', roomCode);
          }} disabled={isEliminated}>{p.name}</button>)}
        </div>
        {isHost && (
          <div style={{marginTop:'15px', padding:'10px', background:'#eee', borderRadius:'10px', textAlign:'center'}}>
            <p style={{fontSize:'0.7rem', margin:0}}>Votos: {votesRecv} / {activePlayers.length}</p>
            <button className="btn btn-accent" style={{marginTop:'5px', fontSize:'0.8rem'}} onClick={() => handleNextStage('VOTE_RESULT')}>VER RESULTADO</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'VOTE_RESULT') {
    const votes = turnInfo?.votes || {};
    const counts: any = {};
    Object.values(votes).forEach((id: any) => counts[id] = (counts[id] || 0) + 1);
    const keys = Object.keys(counts);
    const votedId = keys.length > 0 ? keys.reduce((a, b) => counts[a] > counts[b] ? a : b) : activePlayers[0]?.id;
    const votedPlayer = players.find(p => p.id === votedId);

    const checkWin = (elimId: string) => {
      const newEliminated = [...(turnInfo?.eliminated || []), elimId];
      const aliveImps = players.filter(p => p.is_impostor && !newEliminated.includes(p.id)).length;
      const aliveInnos = players.filter(p => !p.is_impostor && !newEliminated.includes(p.id)).length;
      if (aliveImps === 0) return 'INNOCENTS';
      if (aliveImps >= aliveInnos) return 'IMPOSTORS';
      return null;
    };

    const nextRound = async () => {
      const winner = checkWin(votedId);
      const newEliminated = [...(turnInfo?.eliminated || []), votedId];
      if (winner) {
        if (mode === 'LOCAL') { setTurnInfo({...turnInfo, eliminated: newEliminated, winner}); setScreen('RESULT'); }
        else await supabase.from('rooms').update({ game_state: 'RESULT', turn_info: {...turnInfo, eliminated: newEliminated, winner} }).eq('code', roomCode);
      } else {
        if (mode === 'LOCAL') { setPlayers(players.map(p => ({...p, clue: ''}))); setTurnInfo({...turnInfo, eliminated: newEliminated, votes: {}, round: (turnInfo.round || 1) + 1, starter: players[Math.floor(Math.random()*players.length)].name }); setRevealedIdx(0); setScreen('WRITING'); }
        else { 
          await supabase.from('players').update({ is_ready: false, clue: '' }).eq('room_code', roomCode);
          await supabase.from('rooms').update({ game_state: 'WRITING', turn_info: {...turnInfo, eliminated: newEliminated, votes: {}, round: (turnInfo.round || 1) + 1, chat: [], starter: players[Math.floor(Math.random()*players.length)].name } }).eq('code', roomCode);
        }
      }
    };
    return (
      <div className="card" style={{textAlign:'center'}}>
        <h2>{votedPlayer?.name} fue el más votado.</h2>
        <p style={{fontSize:'2rem'}}>{votedPlayer?.is_impostor ? 'ERA IMPOSTOR 😈' : 'ERA INOCENTE 😇'}</p>
        {isHost && <button className="btn btn-primary" onClick={nextRound}>CONTINUAR</button>}
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={48} color="var(--oro)" />
      <h2>{turnInfo.winner === 'INNOCENTS' ? 'GANARON LOS INOCENTES 😇' : 'GANARON LOS IMPOSTORES 😈'}</h2>
      <div className="grid" style={{marginTop:'20px'}}>
        {players.map(p => <div key={p.id} className={`btn ${p.is_impostor ? 'btn-accent' : 'btn-secondary'}`}>{p.name} {p.is_impostor ? '😈' : '😇'}</div>)}
      </div>
      {isHost && <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={async () => { if (mode === 'LOCAL') setScreen('LOBBY'); else await supabase.from('rooms').update({ game_state: 'LOBBY', turn_info: { starter: null, direction: 'Horario', chat: [], customWords: [], votes: {}, eliminated: [], round: 1, winner: null } }).eq('code', roomCode); }}>OTRA PARTIDA</button>}
    </div>
  );
}
