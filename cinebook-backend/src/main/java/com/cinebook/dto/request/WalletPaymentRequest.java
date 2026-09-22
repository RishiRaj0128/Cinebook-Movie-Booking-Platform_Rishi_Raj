package com.cinebook.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletPaymentRequest {
    @NotNull(message = "bookingId is required")
    private UUID bookingId;

    @Positive(message = "amountPaise must be strictly positive")
    private Long amountPaise;
}
