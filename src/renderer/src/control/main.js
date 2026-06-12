import { createApp } from 'vue';
// 打包進來的 Noto Sans TC(離線可用)
import '@fontsource/noto-sans-tc/400.css';
import '@fontsource/noto-sans-tc/500.css';
import '@fontsource/noto-sans-tc/700.css';
import '@fontsource/noto-sans-tc/900.css';
import Control from './Control.vue';

createApp(Control).mount('#app');
