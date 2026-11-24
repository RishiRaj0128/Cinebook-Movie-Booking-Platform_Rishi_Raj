import React, { useState } from 'react';
import { X, Plus, Minus, Utensils, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { SnackItem, SnackOrderItem } from '../../types';

export const CINE_SNACK_CATALOG: SnackItem[] = [
  {
    id: 'snack-1',
    name: 'Caramel & Truffle Popcorn (Large)',
    category: 'Popcorn',
    pricePaise: 24000,
    description: 'Crispy gourmet popped corn glazed with golden brown caramel and sea salt.',
    imageUrl: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=400&q=80',
    isVeg: true,
  },
  {
    id: 'snack-2',
    name: 'Loaded Mexican Queso Nachos',
    category: 'Bites',
    pricePaise: 21000,
    description: 'Corn tortilla crisps served with warm melted jalapeno queso & zesty salsa dip.',
    imageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&q=80',
    isVeg: true,
  },
  {
    id: 'snack-3',
    name: 'Blockbuster Duo (Pepsi + Mountain Dew 600ml)',
    category: 'Beverages',
    pricePaise: 16000,
    description: 'Ice cold fountain duo in thermal cups keeping fizz frosty throughout the screening.',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80',
    isVeg: true,
  },
  {
    id: 'snack-4',
    name: 'Warm Belgian Chocolate Churros (4 pcs)',
    category: 'Dessert',
    pricePaise: 18000,
    description: 'Cinnamon sugar dusted Spanish churros accompanied by molten dark cocoa dip.',
    imageUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&q=80',
    isVeg: true,
  },
  {
    id: 'snack-5',
    name: '👑 VIP All-Star Feast Combo',
    category: 'Combos',
    pricePaise: 49900,
    description: 'Jumbo Butter Popcorn + Queso Nachos + 2 Drinks + Sweet Churros (Save ₹190)',
    imageUrl: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=400&q=80',
    isVeg: true,
  },
];

interface IntervalExpressModalProps {
  seatsSummary: string; // e.g. "Row C, Seat 4"
  movieTitle: string;
  onClose: () => void;
  onConfirmSnacks: (items: SnackOrderItem[], totalAmountPaise: number) => void;
  initialSelected?: SnackOrderItem[];
}

export const IntervalExpressModal: React.FC<IntervalExpressModalProps> = ({
  seatsSummary,
  movieTitle,
  onClose,
  onConfirmSnacks,
  initialSelected = [],
}) => {
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    initialSelected.forEach((it) => {
      map[it.snack.id] = it.quantity;
    });
    return map;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [success, setSuccess] = useState(false);

  const updateQuantity = (snackId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[snackId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[snackId];
        return copy;
      }
      return { ...prev, [snackId]: next };
    });
  };

  const categories = ['All', 'Popcorn', 'Combos', 'Bites', 'Beverages', 'Dessert'];

  const filteredItems = CINE_SNACK_CATALOG.filter((it) =>
    selectedCategory === 'All' ? true : it.category === selectedCategory
  );

  const cartItems: SnackOrderItem[] = Object.entries(cart)
    .map(([id, qty]) => {
      const snack = CINE_SNACK_CATALOG.find((s) => s.id === id);
      return snack ? { snack, quantity: qty } : null;
    })
    .filter(Boolean) as SnackOrderItem[];

  const totalPaise = cartItems.reduce(
    (sum, item) => sum + item.snack.pricePaise * item.quantity,
    0
  );

  const handleConfirm = () => {
    if (cartItems.length === 0) {
      onClose();
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      onConfirmSnacks(cartItems, totalPaise);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-container"
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #111827 0%, #0b0f19 100%)',
          border: '1px solid rgba(229, 9, 20, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(90deg, #1f1214 0%, #111827 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #e50914, #ff5722)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
              }}
            >
              <Utensils size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 800, letterSpacing: 1.5 }}>
                Interval Express Concession
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                Seat-Side Snack Delivery
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Destination & Timing Promise Pill */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(229, 9, 20, 0.12)',
            borderBottom: '1px solid rgba(229, 9, 20, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: '#fca5a5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="#ef4444" />
            <span>
              Delivered directly to <strong>{seatsSummary || 'Your Seat'}</strong> at interval minute 0!
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', background: '#e50914', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            No Queue Guarantee
          </span>
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '1rem 1.5rem 0.5rem 1.5rem',
            overflowX: 'auto',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: selectedCategory === cat ? '#e50914' : 'rgba(255,255,255,0.06)',
                color: selectedCategory === cat ? '#fff' : '#d1d5db',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Snack Items Grid */}
        <div
          style={{
            padding: '1rem 1.5rem',
            overflowY: 'auto',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {filteredItems.map((snack) => {
            const count = cart[snack.id] || 0;
            return (
              <div
                key={snack.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: count > 0 ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                  padding: '12px',
                  transition: 'all 0.2s',
                }}
              >
                <img
                  src={snack.imageUrl}
                  alt={snack.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '10px',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid #10b981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 3,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#10b981',
                        }}
                      />
                    </span>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f9fafb' }}>
                      {snack.name}
                    </h4>
                  </div>
                  <p style={{ margin: '4px 0 6px 0', fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.3 }}>
                    {snack.description}
                  </p>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f87171' }}>
                    ₹{(snack.pricePaise / 100).toFixed(0)}
                  </div>
                </div>

                {/* Counter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {count > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(229,9,20,0.2)',
                        border: '1px solid #e50914',
                        borderRadius: '20px',
                        padding: '4px 8px',
                      }}
                    >
                      <button
                        onClick={() => updateQuantity(snack.id, -1)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: 16, textAlign: 'center', color: '#fff' }}>
                        {count}
                      </span>
                      <button
                        onClick={() => updateQuantity(snack.id, 1)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => updateQuantity(snack.id, 1)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#f3f4f6',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Cart Summary & Action */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(17, 24, 39, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {cartItems.length} snack item(s) selected
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>
              ₹{(totalPaise / 100).toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#d1d5db',
                padding: '10px 18px',
                borderRadius: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
            <button
              onClick={handleConfirm}
              style={{
                background: success ? '#10b981' : 'linear-gradient(135deg, #e50914, #b20710)',
                border: 'none',
                color: '#fff',
                padding: '10px 22px',
                borderRadius: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(229,9,20,0.4)',
              }}
            >
              {success ? (
                <>
                  <CheckCircle size={18} /> Added to Seat!
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Confirm for Interval
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
