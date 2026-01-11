import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'; // Firebase Auth関数を追加
import { useNavigate } from 'react-router-dom'; // useNavigateを追加

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // useNavigateフックを初期化

  // Firebase Authのインスタンスを取得
  const auth = getAuth();

  const handleLogin = async () => { // async関数に変更
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful');
      navigate('/dashboard'); // ログイン成功後、ダッシュボードへリダイレクト
    } catch (error) {
      console.error('Login failed:', error.message);
      alert('Login failed: ' + error.message); // エラーメッセージを表示
    }
  };

  const handleRegister = async () => { // async関数に変更
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log('Registration successful');
      alert('Registration successful! Please log in.'); // 登録成功メッセージを表示
      // 登録後、自動でログインさせるか、ログイン画面のままにするかは要件次第。今回はアラート表示のみ。
    } catch (error) {
      console.error('Registration failed:', error.message);
      alert('Registration failed: ' + error.message); // エラーメッセージを表示
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h1>Login / Register</h1>
      <div>
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '8px', margin: '5px 0', boxSizing: 'border-box' }}
        />
      </div>
      <div>
        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '8px', margin: '5px 0', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
        <button onClick={handleLogin} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Login
        </button>
        <button onClick={handleRegister} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Register
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
