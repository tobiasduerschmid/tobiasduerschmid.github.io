/* Versioned encrypted ArchUML downloads. The editor owns source snapshots and UI. */
(function () {
  'use strict';

  const ITERATIONS = 200000;

  function bytesToBase64(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function encryptionKey(password, salt) {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 128 },
      false,
      ['encrypt']
    );
  }

  async function encryptDocument({ password, document, version, identity }) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Encrypted export needs Web Crypto support in this browser.');
    }
    // Serialize before yielding so edits during encryption cannot change the download.
    const plaintext = new TextEncoder().encode(JSON.stringify(document));
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await encryptionKey(password, salt);
    const ciphertext = new Uint8Array(await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, plaintext
    ));
    return JSON.stringify({
      format: 'sebook.archuml.encrypted',
      version,
      ...identity,
      createdAt: new Date().toISOString(),
      crypto: {
        algorithm: 'AES-GCM',
        keyLength: 128,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: ITERATIONS,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv)
      },
      ciphertext: bytesToBase64(ciphertext)
    }, null, 2);
  }

  window.UMLEncryptedExport = Object.freeze({
    encryptDiagram({ password, diagramType, archuml }) {
      return encryptDocument({
        password, version: 1, identity: { diagramType },
        document: { diagramType, archuml }
      });
    },
    encryptTutorial({ password, tutorialId, diagrams }) {
      return encryptDocument({
        password, version: 2, identity: { tutorialId },
        document: { tutorialId, diagrams }
      });
    }
  });
}());
