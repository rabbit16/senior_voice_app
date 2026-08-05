/// <reference lib="dom" />

import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppRegistry} from 'react-native';
import App from '../../App';
import './styles.css';

AppRegistry.registerComponent('SeniorVoiceApp', () => App);

const rootTag = document.getElementById('root');

if (!rootTag) {
  throw new Error('Root element not found');
}

createRoot(rootTag).render(<App />);
