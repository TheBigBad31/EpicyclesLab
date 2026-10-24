import { Complex, Point2D } from './types';

export const ComplexOps = {
  create(re: number = 0, im: number = 0): Complex {
    return { re, im };
  },

  fromPoint(p: Point2D): Complex {
    return { re: p.x, im: p.y };
  },

  toPoint(c: Complex): Point2D {
    return { x: c.re, y: c.im };
  },

  add(a: Complex, b: Complex): Complex {
    return { re: a.re + b.re, im: a.im + b.im };
  },

  sub(a: Complex, b: Complex): Complex {
    return { re: a.re - b.re, im: a.im - b.im };
  },

  mul(a: Complex, b: Complex): Complex {
    return {
      re: a.re * b.re - a.im * b.im,
      im: a.re * b.im + a.im * b.re,
    };
  },

  scale(c: Complex, factor: number): Complex {
    return { re: c.re * factor, im: c.im * factor };
  },

  abs(c: Complex): number {
    return Math.hypot(c.re, c.im);
  },

  absSq(c: Complex): number {
    return c.re * c.re + c.im * c.im;
  },

  arg(c: Complex): number {
    return Math.atan2(c.im, c.re);
  },

  fromPolar(r: number, theta: number): Complex {
    return {
      re: r * Math.cos(theta),
      im: r * Math.sin(theta),
    };
  },

  exp(c: Complex): Complex {
    const expRe = Math.exp(c.re);
    return {
      re: expRe * Math.cos(c.im),
      im: expRe * Math.sin(c.im),
    };
  },

  conjugate(c: Complex): Complex {
    return { re: c.re, im: -c.im };
  },
};
