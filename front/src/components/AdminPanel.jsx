import React, { useState, useEffect } from 'react';

const AdminPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('jugadores');
  const [users, setUsers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [structures, setStructures] = useState([]);
  const [shopUpgrades, setShopUpgrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [editingUpgrade, setEditingUpgrade] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle ESC key to close panel
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadLevels(),
        loadStructures(),
        loadShopUpgrades()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadLevels = async () => {
    try {
      const response = await fetch('/api/admin/levels', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load levels');
      const data = await response.json();
      setLevels(data);
    } catch (error) {
      console.error('Error loading levels:', error);
    }
  };

  const loadStructures = async () => {
    try {
      const response = await fetch('/api/admin/structures', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load structures');
      const data = await response.json();
      setStructures(data);
    } catch (error) {
      console.error('Error loading structures:', error);
    }
  };

  const loadShopUpgrades = async () => {
    try {
      const response = await fetch('/api/shop/upgrades');
      if (!response.ok) throw new Error('Failed to load shop upgrades');
      const data = await response.json();
      setShopUpgrades(data);
    } catch (error) {
      console.error('Error loading shop upgrades:', error);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update user');
      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar usuario');
    }
  };

  const updateLevel = async (levelId, updates) => {
    try {
      const response = await fetch(`/api/admin/levels/${levelId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update level');
      await loadLevels();
      setEditingLevel(null);
    } catch (error) {
      console.error('Error updating level:', error);
      alert('Error al actualizar nivel');
    }
  };

  const createLevel = async (levelData) => {
    try {
      const response = await fetch('/api/admin/levels', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(levelData)
      });
      if (!response.ok) throw new Error('Failed to create level');
      await loadLevels();
      setEditingLevel(null);
    } catch (error) {
      console.error('Error creating level:', error);
      alert('Error al crear nivel');
    }
  };

  const updateShopUpgrade = async (upgradeType, level, updates) => {
    try {
      const response = await fetch(`/api/shop/upgrades/${upgradeType}/${level}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update upgrade');
      await loadShopUpgrades();
      setEditingUpgrade(null);
    } catch (error) {
      console.error('Error updating upgrade:', error);
      alert('Error al actualizar mejora');
    }
  };

  const InputField = ({ label, value, onChange, type = 'number', min, max }) => (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', color: '#33ffff', fontSize: '12px', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
        min={min}
        max={max}
        style={{
          width: '100%',
          padding: '6px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid #33ffff',
          color: '#33ffff',
          borderRadius: '4px',
          fontSize: '14px'
        }}
      />
    </div>
  );

  const Button = ({ onClick, children, style = {} }) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: 'transparent',
        border: '2px solid #33ffff',
        color: '#33ffff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.3s',
        ...style
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(51, 255, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        color: '#33ffff',
        fontSize: '20px'
      }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.98)',
      zIndex: 10000,
      overflow: 'auto',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        background: 'rgba(10, 10, 10, 0.95)',
        border: '2px solid #33ffff',
        borderRadius: '10px',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #33ffff',
          paddingBottom: '15px'
        }}>
          <h1 style={{ color: '#33ffff', fontSize: '28px', margin: 0 }}>
            Panel de Administración
          </h1>
          <Button onClick={onClose}>Cerrar [ESC]</Button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          borderBottom: '1px solid #33ffff'
        }}>
          {['jugadores', 'niveles', 'tienda'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setEditingUser(null);
                setEditingLevel(null);
                setEditingUpgrade(null);
              }}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? 'rgba(51, 255, 255, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #33ffff' : 'none',
                color: '#33ffff',
                cursor: 'pointer',
                fontSize: '16px',
                textTransform: 'capitalize',
                fontWeight: activeTab === tab ? 'bold' : 'normal'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '500px' }}>
          {/* Jugadores Tab */}
          {activeTab === 'jugadores' && (
            <div>
              <h2 style={{ color: '#33ffff', marginBottom: '15px' }}>Gestión de Jugadores</h2>
              <div style={{
                overflowX: 'auto',
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
                padding: '15px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#33ffff' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #33ffff' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Usuario</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>XP Total</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Estrellas</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Mejor Score</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Nivel</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Estado</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Admin</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} style={{ borderBottom: '1px solid rgba(51, 255, 255, 0.2)' }}>
                        <td style={{ padding: '10px' }}>{user.username}</td>
                        <td style={{ padding: '10px' }}>{user.totalXp}</td>
                        <td style={{ padding: '10px' }}>{user.totalStars}</td>
                        <td style={{ padding: '10px' }}>{user.bestScore}</td>
                        <td style={{ padding: '10px' }}>{user.currentLevel}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ color: user.isBanned ? '#ff3366' : '#00ff00' }}>
                            {user.isBanned ? 'Baneado' : 'Activo'}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ color: user.isAdmin ? '#33ffff' : '#888' }}>
                            {user.isAdmin ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <Button
                            onClick={() => setEditingUser(user)}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Edit User Modal */}
              {editingUser && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.9)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10001
                }}>
                  <div style={{
                    background: 'rgba(10, 10, 10, 0.98)',
                    border: '2px solid #33ffff',
                    borderRadius: '10px',
                    padding: '30px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto'
                  }}>
                    <h3 style={{ color: '#33ffff', marginBottom: '20px' }}>
                      Editar: {editingUser.username}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <InputField
                        label="XP Total"
                        value={editingUser.totalXp}
                        onChange={(val) => setEditingUser({ ...editingUser, totalXp: val })}
                      />
                      <InputField
                        label="Estrellas Total"
                        value={editingUser.totalStars}
                        onChange={(val) => setEditingUser({ ...editingUser, totalStars: val })}
                      />
                      <InputField
                        label="Mejor Score"
                        value={editingUser.bestScore}
                        onChange={(val) => setEditingUser({ ...editingUser, bestScore: val })}
                      />
                      <InputField
                        label="Nivel Actual"
                        value={editingUser.currentLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, currentLevel: val })}
                      />
                      <InputField
                        label="Escudo"
                        value={editingUser.shieldLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, shieldLevel: val })}
                        min={0}
                        max={5}
                      />
                      <InputField
                        label="Cabeza"
                        value={editingUser.headLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, headLevel: val })}
                        min={1}
                        max={3}
                      />
                      <InputField
                        label="Cañón"
                        value={editingUser.cannonLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, cannonLevel: val })}
                        min={0}
                        max={5}
                      />
                      <InputField
                        label="Imán"
                        value={editingUser.magnetLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, magnetLevel: val })}
                        min={0}
                        max={5}
                      />
                      <InputField
                        label="Velocidad"
                        value={editingUser.speedLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, speedLevel: val })}
                        min={0}
                        max={10}
                      />
                      <InputField
                        label="Velocidad Bala"
                        value={editingUser.bulletSpeedLevel}
                        onChange={(val) => setEditingUser({ ...editingUser, bulletSpeedLevel: val })}
                        min={0}
                        max={10}
                      />
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <label style={{ color: '#33ffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={editingUser.isBanned}
                          onChange={(e) => setEditingUser({ ...editingUser, isBanned: e.target.checked })}
                          style={{ width: '20px', height: '20px' }}
                        />
                        Baneado
                      </label>
                      <label style={{ color: '#33ffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={editingUser.isAdmin}
                          onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                          style={{ width: '20px', height: '20px' }}
                        />
                        Administrador
                      </label>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <Button onClick={() => updateUser(editingUser.id, editingUser)}>
                        Guardar
                      </Button>
                      <Button onClick={() => setEditingUser(null)} style={{ borderColor: '#ff3366', color: '#ff3366' }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Niveles Tab */}
          {activeTab === 'niveles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: '#33ffff', margin: 0 }}>Gestión de Niveles</h2>
                <Button onClick={() => setEditingLevel({ levelNumber: levels.length + 1, starsNeeded: 1, playerSpeed: 2.0, enemySpeed: 2.0, enemyCount: 5, enemyDensity: 15, enemyShootPercentage: 0, enemyShieldPercentage: 0, enemyShootCooldown: 5000, xpDensity: 100, backgroundType: 'default', structureId: null, hasCentralCell: false, centralCellOpeningSpeed: 0.002 })}>
                  Crear Nuevo Nivel
                </Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {levels.map(level => (
                  <div
                    key={level.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '2px solid #33ffff',
                      borderRadius: '8px',
                      padding: '15px'
                    }}
                  >
                    <h3 style={{ color: '#33ffff', marginTop: 0 }}>Nivel {level.levelNumber}</h3>
                    <p style={{ color: '#888', fontSize: '12px', margin: '5px 0' }}>
                      Enemigos: {level.enemyCount} | Estrellas: {level.starsNeeded}
                    </p>
                    <p style={{ color: '#888', fontSize: '12px', margin: '5px 0' }}>
                      Estructura: {level.structureName || 'Ninguna'}
                    </p>
                    <Button
                      onClick={() => setEditingLevel(level)}
                      style={{ marginTop: '10px', width: '100%' }}
                    >
                      Editar
                    </Button>
                  </div>
                ))}
              </div>

              {/* Edit Level Modal */}
              {editingLevel && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.9)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10001
                }}>
                  <div style={{
                    background: 'rgba(10, 10, 10, 0.98)',
                    border: '2px solid #33ffff',
                    borderRadius: '10px',
                    padding: '30px',
                    maxWidth: '700px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto'
                  }}>
                    <h3 style={{ color: '#33ffff', marginBottom: '20px' }}>
                      {editingLevel.id ? `Editar Nivel ${editingLevel.levelNumber}` : 'Crear Nuevo Nivel'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <InputField
                        label="Número de Nivel"
                        value={editingLevel.levelNumber}
                        onChange={(val) => setEditingLevel({ ...editingLevel, levelNumber: val })}
                      />
                      <InputField
                        label="Estrellas Necesarias"
                        value={editingLevel.starsNeeded}
                        onChange={(val) => setEditingLevel({ ...editingLevel, starsNeeded: val })}
                      />
                      <InputField
                        label="Velocidad Jugador"
                        value={editingLevel.playerSpeed}
                        onChange={(val) => setEditingLevel({ ...editingLevel, playerSpeed: val })}
                        type="number"
                      />
                      <InputField
                        label="Velocidad Enemigos"
                        value={editingLevel.enemySpeed}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemySpeed: val })}
                        type="number"
                      />
                      <InputField
                        label="Cantidad Enemigos"
                        value={editingLevel.enemyCount}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemyCount: val })}
                      />
                      <InputField
                        label="Densidad Enemigos"
                        value={editingLevel.enemyDensity}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemyDensity: val })}
                      />
                      <InputField
                        label="% Enemigos Disparan"
                        value={editingLevel.enemyShootPercentage}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemyShootPercentage: val })}
                        min={0}
                        max={100}
                      />
                      <InputField
                        label="% Enemigos con Escudo"
                        value={editingLevel.enemyShieldPercentage}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemyShieldPercentage: val })}
                        min={0}
                        max={100}
                      />
                      <InputField
                        label="Cooldown Disparo (ms)"
                        value={editingLevel.enemyShootCooldown}
                        onChange={(val) => setEditingLevel({ ...editingLevel, enemyShootCooldown: val })}
                      />
                      <InputField
                        label="Densidad XP"
                        value={editingLevel.xpDensity}
                        onChange={(val) => setEditingLevel({ ...editingLevel, xpDensity: val })}
                      />
                      <InputField
                        label="Tipo de Fondo"
                        value={editingLevel.backgroundType}
                        onChange={(val) => setEditingLevel({ ...editingLevel, backgroundType: val })}
                        type="text"
                      />
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', color: '#33ffff', fontSize: '12px', marginBottom: '4px' }}>
                          Estructura
                        </label>
                        <select
                          value={editingLevel.structureId || ''}
                          onChange={(e) => setEditingLevel({ ...editingLevel, structureId: e.target.value ? parseInt(e.target.value) : null })}
                          style={{
                            width: '100%',
                            padding: '6px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            border: '1px solid #33ffff',
                            color: '#33ffff',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="">Ninguna</option>
                          {structures.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#33ffff', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={editingLevel.hasCentralCell}
                            onChange={(e) => setEditingLevel({ ...editingLevel, hasCentralCell: e.target.checked })}
                            style={{ width: '20px', height: '20px' }}
                          />
                          Tiene Celda Central
                        </label>
                      </div>
                      <InputField
                        label="Velocidad Apertura Celda"
                        value={editingLevel.centralCellOpeningSpeed}
                        onChange={(val) => setEditingLevel({ ...editingLevel, centralCellOpeningSpeed: val })}
                        type="number"
                      />
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <Button onClick={() => {
                        if (editingLevel.id) {
                          updateLevel(editingLevel.id, editingLevel);
                        } else {
                          createLevel(editingLevel);
                        }
                      }}>
                        {editingLevel.id ? 'Guardar' : 'Crear'}
                      </Button>
                      <Button onClick={() => setEditingLevel(null)} style={{ borderColor: '#ff3366', color: '#ff3366' }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tienda Tab */}
          {activeTab === 'tienda' && (
            <div>
              <h2 style={{ color: '#33ffff', marginBottom: '15px' }}>Gestión de Tienda</h2>
              {Object.keys(shopUpgrades).map(upgradeType => (
                <div key={upgradeType} style={{ marginBottom: '30px' }}>
                  <h3 style={{ color: '#33ffff', textTransform: 'capitalize', marginBottom: '10px' }}>
                    {upgradeType.replace('_', ' ')}
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: '15px'
                  }}>
                    {shopUpgrades[upgradeType]?.map(upgrade => (
                      <div
                        key={`${upgradeType}-${upgrade.level}`}
                        style={{
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '2px solid #33ffff',
                          borderRadius: '8px',
                          padding: '15px'
                        }}
                      >
                        <h4 style={{ color: '#33ffff', marginTop: 0 }}>Nivel {upgrade.level}</h4>
                        <p style={{ color: '#888', fontSize: '12px', margin: '5px 0' }}>
                          {upgrade.description}
                        </p>
                        <p style={{ color: '#33ffff', fontSize: '14px', margin: '5px 0' }}>
                          Costo: {upgrade.xpCost > 0 && `${upgrade.xpCost} XP`} {upgrade.starsCost > 0 && `${upgrade.starsCost} ⭐`}
                        </p>
                        <Button
                          onClick={() => setEditingUpgrade({ type: upgradeType, level: upgrade.level, ...upgrade })}
                          style={{ marginTop: '10px', width: '100%' }}
                        >
                          Editar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Edit Upgrade Modal */}
              {editingUpgrade && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.9)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10001
                }}>
                  <div style={{
                    background: 'rgba(10, 10, 10, 0.98)',
                    border: '2px solid #33ffff',
                    borderRadius: '10px',
                    padding: '30px',
                    maxWidth: '500px',
                    width: '90%'
                  }}>
                    <h3 style={{ color: '#33ffff', marginBottom: '20px' }}>
                      Editar: {editingUpgrade.type.replace('_', ' ')} Nivel {editingUpgrade.level}
                    </h3>
                    <InputField
                      label="Costo XP"
                      value={editingUpgrade.xpCost}
                      onChange={(val) => setEditingUpgrade({ ...editingUpgrade, xpCost: val })}
                    />
                    <InputField
                      label="Costo Estrellas"
                      value={editingUpgrade.starsCost}
                      onChange={(val) => setEditingUpgrade({ ...editingUpgrade, starsCost: val })}
                    />
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', color: '#33ffff', fontSize: '12px', marginBottom: '4px' }}>
                        Descripción
                      </label>
                      <textarea
                        value={editingUpgrade.description}
                        onChange={(e) => setEditingUpgrade({ ...editingUpgrade, description: e.target.value })}
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '6px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: '1px solid #33ffff',
                          color: '#33ffff',
                          borderRadius: '4px',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <Button onClick={() => {
                        updateShopUpgrade(editingUpgrade.type, editingUpgrade.level, {
                          xpCost: editingUpgrade.xpCost,
                          starsCost: editingUpgrade.starsCost,
                          description: editingUpgrade.description
                        });
                      }}>
                        Guardar
                      </Button>
                      <Button onClick={() => setEditingUpgrade(null)} style={{ borderColor: '#ff3366', color: '#ff3366' }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

