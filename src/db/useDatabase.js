// src/db/useDatabase.js
//
// SQLite WASM hook via sql.js.
// Persists to localStorage (base-64 encoded binary SQLite file).
// Tables: favorites(town TEXT PK)  |  notes(town TEXT PK, body TEXT)

import { useState, useEffect, useCallback, useRef } from 'react';
import initSqlJs from 'sql.js';

const STORAGE_KEY = 'himalayan_db_v1';

function dbPersist(db) {
  try {
    const arr = db.export();
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    localStorage.setItem(STORAGE_KEY, btoa(bin));
  } catch (e) {
    console.warn('[DB] persist failed:', e.message);
  }
}

export function useDatabase() {
  const dbRef = useRef(null);
  const [ready,     setReady]     = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [notes,     setNotes]     = useState({});

  useEffect(() => {
    let alive = true;
    initSqlJs({ locateFile: () => `${process.env.PUBLIC_URL}/sql-wasm.wasm` })
      .then(SQL => {
        if (!alive) return;
        const saved = localStorage.getItem(STORAGE_KEY);
        let db;
        if (saved) {
          const bin = atob(saved);
          const buf = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          db = new SQL.Database(buf);
        } else {
          db = new SQL.Database();
        }
        db.run(`
          CREATE TABLE IF NOT EXISTS favorites(town TEXT PRIMARY KEY);
          CREATE TABLE IF NOT EXISTS notes(town TEXT PRIMARY KEY, body TEXT DEFAULT '');
        `);
        dbRef.current = db;

        const favRows  = db.exec('SELECT town FROM favorites');
        const noteRows = db.exec('SELECT town, body FROM notes');
        setFavorites(new Set(favRows[0]?.values.map(r => r[0]) ?? []));
        setNotes(Object.fromEntries(noteRows[0]?.values ?? []));
        setReady(true);
      })
      .catch(err => console.error('[DB] init error:', err));
    return () => { alive = false; };
  }, []);

  const toggleFavorite = useCallback((town) => {
    const db = dbRef.current;
    if (!db) return;
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(town)) {
        db.run('DELETE FROM favorites WHERE town = ?', [town]);
        next.delete(town);
      } else {
        db.run('INSERT OR REPLACE INTO favorites(town) VALUES(?)', [town]);
        next.add(town);
      }
      dbPersist(db);
      return next;
    });
  }, []);

  const saveNote = useCallback((town, body) => {
    const db = dbRef.current;
    if (!db) return;
    const trimmed = body.trim();
    if (trimmed) {
      db.run('INSERT OR REPLACE INTO notes(town, body) VALUES(?,?)', [town, trimmed]);
    } else {
      db.run('DELETE FROM notes WHERE town = ?', [town]);
    }
    dbPersist(db);
    setNotes(prev => {
      const next = { ...prev };
      if (trimmed) next[town] = trimmed;
      else delete next[town];
      return next;
    });
  }, []);

  return { ready, favorites, notes, toggleFavorite, saveNote };
}
