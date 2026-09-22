package com.cinebook.util;

import com.cinebook.domain.enums.SeatType;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

@Component
public class PricingUtil {

    private static final Map<SeatType, Double> MULTIPLIERS = Map.of(
            SeatType.REGULAR,  1.0,
            SeatType.PREMIUM,  1.5,
            SeatType.RECLINER, 2.0
    );

    private static final double CONVENIENCE_FEE_RATE = 0.025; // 2.5%
    private static final double GST_RATE = 0.18;               // 18%

    public int calculateSeatPrice(int basePricePaise, SeatType type) {
        double mult = MULTIPLIERS.getOrDefault(type, 1.0);
        return (int) Math.round(basePricePaise * mult);
    }

    public int calculateSubtotal(Iterable<Integer> seatPricesPaise) {
        int subtotal = 0;
        for (int p : seatPricesPaise) {
            subtotal += p;
        }
        return subtotal;
    }

    public int calculateConvenienceFee(int subtotalPaise) {
        return (int) Math.round(subtotalPaise * CONVENIENCE_FEE_RATE);
    }

    public int calculateGST(int subtotalPaise) {
        return (int) Math.round(subtotalPaise * GST_RATE);
    }

    public int calculateTotalAmount(int subtotalPaise) {
        return subtotalPaise + calculateConvenienceFee(subtotalPaise) + calculateGST(subtotalPaise);
    }

    public String formatINR(int paise) {
        return NumberFormat.getCurrencyInstance(Locale.of("en", "IN"))
                .format(paise / 100.0);
    }
}
