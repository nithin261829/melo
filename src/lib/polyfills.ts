// Web APIs youtubei.js expects that Hermes/React Native don't provide. Must load before anything else.
import 'react-native-url-polyfill/auto';
import 'event-target-polyfill';
import { ReadableStream } from 'web-streams-polyfill';
import { decode, encode } from 'base-64';
import { getRandomValues, randomUUID } from 'expo-crypto';

const g = globalThis as any;

g.ReadableStream ??= ReadableStream;
g.atob ??= decode;
g.btoa ??= encode;

g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues;
g.crypto.randomUUID ??= randomUUID;

if (!g.CustomEvent) {
  g.CustomEvent = class CustomEvent extends g.Event {
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      super(type, init);
      this.detail = init?.detail;
    }
  };
}
